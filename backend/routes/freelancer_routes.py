from flask import Blueprint, request, jsonify, g, make_response
from datetime import datetime, timedelta
import uuid
from flask_cors import cross_origin
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Freelancer, Service, Appointment, TimeSlot, MasterTimeSlot
from email_utils import send_branded_customer_reply
import os
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
from datetime import datetime, timedelta
from utils.decorators import require_auth, require_tier
from utils.features import is_feature_enabled
import re
from werkzeug.security import generate_password_hash, check_password_hash
import stripe
from zoneinfo import ZoneInfo
from utils.timezone_utils import parse_time_in_timezone


from models import (
    db,
    Freelancer,
    TimeSlot,
    Appointment,
    MasterTimeSlot,
    Service,
    ServiceAddon,
    User,
)
from email_utils import send_branded_customer_reply
from config import ALLOWED_ORIGINS, RESERVED_ROUTES

freelancer_bp = Blueprint("freelancer", __name__)


def handle_404(_):
    return make_response(jsonify({"error": "Not found"}), 404)


@freelancer_bp.route("/freelancer/slots/<identifier>", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def get_public_time_slots(identifier):
    from sqlalchemy.orm import joinedload

    # 🔥 NEW: Priority lookup order
    if identifier.isdigit():
        freelancer_id = int(identifier)
    else:
        # Try custom_url first (paid tiers)
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()

        # Try public_slug second (all users)
        if not freelancer:
            freelancer = Freelancer.query.filter_by(
                public_slug=identifier.lower()
            ).first()

        if not freelancer:
            return jsonify({"error": "Freelancer not found"}), 404

        freelancer_id = freelancer.id

    if request.method == "OPTIONS":
        return jsonify({}), 200

    # Fetch all master times in order to map time labels to IDs
    master_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_label_to_id = {mt.label: mt.id for mt in master_times}
    time_labels = [mt.label for mt in master_times]

    # Precompute inherited slot IDs
    inherited_ids = set()
    appointments = (
        Appointment.query.filter_by(freelancer_id=freelancer_id, status="confirmed")
        .options(
            joinedload(Appointment.slot).joinedload(TimeSlot.master_time),
            joinedload(Appointment.service),
        )
        .all()
    )
    for appt in appointments:
        slot = appt.slot
        service = appt.service
        if not slot or not service:
            continue
        start_label = slot.master_time.label
        try:
            start_idx = time_labels.index(start_label)
            blocks = service.duration_minutes // 15
            inherited_labels = time_labels[start_idx + 1 : start_idx + blocks]
            for label in inherited_labels:
                inherited_id = TimeSlot.query.filter_by(
                    freelancer_id=freelancer_id,
                    day=slot.day,
                    master_time_id=time_label_to_id[label],
                ).first()
                if inherited_id:
                    inherited_ids.add(inherited_id.id)
        except ValueError:
            continue

    # Fetch all slots
    slots = (
        TimeSlot.query.options(
            joinedload(TimeSlot.master_time),
            joinedload(TimeSlot.appointment).joinedload(Appointment.user),
            joinedload(TimeSlot.appointment).joinedload(Appointment.service),
        )
        .filter_by(freelancer_id=freelancer_id)
        .join(MasterTimeSlot, TimeSlot.master_time_id == MasterTimeSlot.id)
        .order_by(
            TimeSlot.timezone.asc(),
            TimeSlot.day.asc(),  # ← Move day BEFORE time
            MasterTimeSlot.time_24h.asc(),
        )
        .all()
    )

    # 🔥 DEBUG: Log timezone distribution
    from collections import defaultdict

    tz_groups = defaultdict(int)
    for slot in slots:
        tz_groups[slot.timezone or "NULL"] += 1

    print(
        f"\n🌍 BACKEND: Fetched {len(slots)} total slots for freelancer {freelancer_id}"
    )
    print(f"📊 TIMEZONE DISTRIBUTION:")
    for tz, count in sorted(tz_groups.items()):
        print(f"   {tz}: {count} slots")

    # 🔥 DEBUG: Show first 20 slots as returned by query
    print(f"\n🔍 FIRST 20 SLOTS (as ordered by SQL):")
    for i, slot in enumerate(slots[:20]):
        print(
            f"   #{i+1}: day={slot.day}, tz={slot.timezone}, time={slot.master_time.time_24h}, id={slot.id}"
        )

    # 🔥 SELF-HEALING: Auto-fix any NULL timezone slots (from old seeds/migrations)
    freelancer = Freelancer.query.get(freelancer_id)
    null_timezone_slots = [s for s in slots if not s.timezone]
    if null_timezone_slots and freelancer:
        print(f"🔄 Fixing {len(null_timezone_slots)} slots with NULL timezone")
        for slot in null_timezone_slots:
            slot.timezone = freelancer.timezone
        db.session.commit()

    result = []
    for slot in slots:
        is_inherited = slot.id in inherited_ids
        confirmed_appt = Appointment.query.filter_by(
            slot_id=slot.id, status="confirmed"
        ).first()
        is_root_booked = confirmed_appt and not is_inherited

        user_info = None
        service_name = None
        duration_minutes = None

        if is_root_booked:
            user = confirmed_appt.user
            service = confirmed_appt.service
            if user:
                user_info = {
                    "name": f"{user.first_name} {user.last_name}",
                    "email": user.email,
                }
            if service:
                service_name = service.name
                duration_minutes = service.duration_minutes

        # Log each slot as it's being added to result
        print(
            f"🔍 Returning slot: day={slot.day}, time={slot.master_time.time_24h}, master_time_id={slot.master_time.id}"
        )
        print(f"🔍 Master label: {slot.master_time.label}")

        result.append(
            {
                "id": slot.id,
                "time": slot.master_time.time_24h,  # Legacy key (24h format for compatibility)
                "time_24h": slot.master_time.time_24h,  # Canonical UTC 24h string like "18:00"
                "time_12h": slot.master_time.label,  # UTC 12h string like "06:00 PM"
                "day": slot.day,
                "is_booked": is_root_booked,
                "is_inherited_block": is_inherited,
                "appointment": user_info,
                "service_name": service_name,
                "duration_minutes": duration_minutes,
                "timezone": slot.timezone,  # 🔥 NEW: Send frozen timezone
            }
        )

    # 🔥 DEBUG: Print sorted slots
    print("\n🔍 SORTED SLOTS DEBUG:")
    for slot in slots[:20]:  # Print first 20 slots
        print(
            f"  day={slot.day}, timezone={slot.timezone}, time_24h={slot.master_time.time_24h}, id={slot.id}"
        )

    return jsonify(result)


@freelancer_bp.route("/freelancer/public-info/<identifier>", methods=["GET", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def get_public_freelancer_info(identifier):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    # 🔥 NEW: Priority lookup order
    freelancer = None
    if identifier.isdigit():
        freelancer = Freelancer.query.get(int(identifier))
    else:
        # Try custom_url first (paid tiers)
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()

        # Try public_slug second (all users)
        if not freelancer:
            freelancer = Freelancer.query.filter_by(
                public_slug=identifier.lower()
            ).first()

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    services = Service.query.filter_by(
        freelancer_id=freelancer.id, is_enabled=True
    ).all()
    service_data = [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "duration_minutes": s.duration_minutes,
            "price_usd": s.price_usd or 0.0,
            "is_enabled": s.is_enabled,
            "business_address": freelancer.business_address,
        }
        for s in services
    ]

    return jsonify(
        {
            "id": freelancer.id,
            "first_name": freelancer.first_name,
            "last_name": freelancer.last_name,
            "business_name": freelancer.business_name,
            "custom_url": freelancer.custom_url,
            "public_slug": freelancer.public_slug,
            "logo_url": freelancer.logo_url,
            "tagline": freelancer.tagline,
            "bio": freelancer.bio,
            "faq_items": freelancer.faq_items,
            "timezone": freelancer.timezone,
            "is_verified": freelancer.tier in ["pro", "elite"],
            "email": freelancer.contact_email,
            "phone": freelancer.business_phone,  # 🔥 CHANGED: Return business phone only
            "instagram_url": freelancer.instagram_url,
            "twitter_url": freelancer.twitter_url,
            "no_show_policy": freelancer.no_show_policy,
            "created_at": (
                freelancer.created_at.isoformat() if freelancer.created_at else None
            ),
            "tier": freelancer.tier,
            "services": service_data,
            "location": freelancer.location,
            "booking_instructions": freelancer.booking_instructions,
            "preferred_payment_methods": freelancer.preferred_payment_methods,
        }
    )


@freelancer_bp.route("/freelancers/<identifier>", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS)
def public_freelancer_profile(identifier):
    # 🔥 NEW: Priority lookup order
    if identifier.isdigit():
        freelancer = Freelancer.query.get(int(identifier))
    else:
        # Try custom_url first (paid tiers)
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()

        # Try public_slug second (all users)
        if not freelancer:
            freelancer = Freelancer.query.filter_by(
                public_slug=identifier.lower()
            ).first()

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    services = Service.query.filter_by(freelancer_id=freelancer.id).all()
    service_data = [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "duration_minutes": s.duration_minutes,
            "price_usd": s.price_usd or 0.0,
            "is_enabled": s.is_enabled,
        }
        for s in services
        if s.is_enabled
    ]

    return jsonify(
        {
            "id": freelancer.id,
            "first_name": freelancer.first_name,
            "last_name": freelancer.last_name,
            "business_name": freelancer.business_name,
            "logo_url": freelancer.logo_url,
            "tagline": freelancer.tagline,
            "bio": freelancer.bio,
            "timezone": freelancer.timezone,
            "email": freelancer.contact_email,
            "phone": freelancer.business_phone,  # 🔥 CHANGED: Return business phone only
            "instagram_url": freelancer.instagram_url,
            "twitter_url": freelancer.twitter_url,
            "is_verified": freelancer.tier in ["pro", "elite"],
            "joined": freelancer.id,
            "services": service_data,
            "faq_items": freelancer.faq_items,
            "location": freelancer.location,
            "booking_instructions": freelancer.booking_instructions,
            "preferred_payment_methods": freelancer.preferred_payment_methods,
        }
    )


@freelancer_bp.route("/freelancer/services", methods=["GET", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def get_services():
    if request.method == "OPTIONS":
        return "", 200

    freelancer_id = int(get_jwt_identity())
    if not freelancer_id:
        return jsonify({"error": "Missing freelancer ID"}), 403

    services = Service.query.filter_by(freelancer_id=freelancer_id).all()
    result = [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "duration_minutes": s.duration_minutes,
            "price_usd": s.price_usd,
            "is_enabled": s.is_enabled,
        }
        for s in services
    ]
    return jsonify(result)


@freelancer_bp.route("/freelancer/services", methods=["POST", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def add_service():
    if request.method == "OPTIONS":
        return "", 200

    freelancer_id = int(get_jwt_identity())
    if not freelancer_id:
        return jsonify({"error": "Missing freelancer ID"}), 403

    data = request.get_json()
    print("🧪 Incoming service data:", data)

    # Extract and sanitize
    # Store raw text - React escapes in UI, plain text emails are XSS-safe
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    duration_raw = data.get("duration_minutes")
    price_raw = data.get("price_usd")

    # Validate name + description
    if not name:
        return jsonify({"error": "Name is required"}), 422
    if not description:
        return jsonify({"error": "Description is required"}), 422

    # Validate duration
    try:
        duration_minutes = int(duration_raw)
        if duration_minutes < 15 or duration_minutes % 15 != 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid duration — must be a multiple of 15"}), 422

    # Validate price
    try:
        price_usd = float(price_raw)
        if price_usd < 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid price"}), 422

    # Create service
    service = Service(
        freelancer_id=freelancer_id,
        name=name,
        description=description,
        duration_minutes=duration_minutes,
        price_usd=price_usd,
    )

    db.session.add(service)
    db.session.commit()
    return jsonify({"message": "Service added!"}), 201


@freelancer_bp.route(
    "/freelancer/services/<int:service_id>", methods=["DELETE", "OPTIONS"]
)
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def delete_service(service_id):
    if request.method == "OPTIONS":
        return "", 200

    try:
        freelancer_id = get_jwt_identity()
        service = Service.query.filter_by(
            id=service_id, freelancer_id=freelancer_id
        ).first()

        if not service:
            return jsonify({"error": "Service not found"}), 404

        db.session.delete(service)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200

    except Exception as e:
        print("❌ Delete service error:", str(e))
        return jsonify({"error": "Internal server error"}), 500


@freelancer_bp.route(
    "/freelancer/services/<int:service_id>", methods=["PATCH", "OPTIONS"]
)
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def update_service(service_id):
    if request.method == "OPTIONS":
        return "", 200

    service = Service.query.get(service_id)
    if not service:
        return jsonify({"error": "Service not found"}), 404

    data = request.json
    # Store raw text - React escapes in UI, plain text emails are XSS-safe
    service.name = (
        data.get("name", service.name).strip() if "name" in data else service.name
    )
    service.description = (
        data.get("description", service.description).strip()
        if "description" in data
        else service.description
    )
    service.duration_minutes = data.get("duration_minutes", service.duration_minutes)
    service.price_usd = data.get("price_usd", service.price_usd)

    # Enable/disable toggle (optional)
    if "is_enabled" in data:
        service.is_enabled = bool(data["is_enabled"])

    db.session.commit()
    return jsonify({"message": "Service updated"})


@freelancer_bp.route("/freelancer/analytics", methods=["GET"])
@require_auth
@require_tier("analytics")  # maps to ["elite"] from FEATURES
def get_analytics():
    freelancer_id = g.freelancer.id
    from sqlalchemy import func

    # Count totals by status
    total = Appointment.query.filter(
        Appointment.freelancer_id == freelancer_id, Appointment.status != "cancelled"
    ).count()
    confirmed = Appointment.query.filter_by(
        freelancer_id=freelancer_id, status="confirmed"
    ).count()
    cancelled = Appointment.query.filter_by(
        freelancer_id=freelancer_id, status="cancelled"
    ).count()

    # Top service
    # Returns all tied top services
    top_services = (
        db.session.query(Service.name, func.count(Appointment.id).label("count"))
        .join(Appointment, Service.id == Appointment.service_id)
        .filter(
            Service.freelancer_id == freelancer_id, Appointment.status == "confirmed"
        )
        .group_by(Service.id)
        .order_by(func.count(Appointment.id).desc())
        .all()
    )

    # Take all tied top names
    max_count = top_services[0][1] if top_services else 0
    top_names = [name for name, count in top_services if count == max_count]

    # Pie chart: bookings per service
    service_counts = (
        db.session.query(Service.name, func.count(Appointment.id))
        .join(Appointment, Service.id == Appointment.service_id)
        .filter(
            Service.freelancer_id == freelancer_id, Appointment.status == "confirmed"
        )
        .group_by(Service.name)
        .all()
    )
    service_chart_data = [
        {"id": name, "value": count} for name, count in service_counts
    ]

    # Line chart: booking trend by scheduled day (regardless of status)
    trend_counts = (
        db.session.query(TimeSlot.day, func.count(Appointment.id))
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .filter(
            Appointment.freelancer_id == freelancer_id,
            Appointment.status != "cancelled",
        )
        .group_by(TimeSlot.day)
        .order_by(TimeSlot.day)
        .all()
    )
    trend_data = [{"x": day, "y": count} for day, count in trend_counts]

    # Bar chart: revenue per service (only confirmed)
    revenue_per_service = (
        db.session.query(Service.name, func.sum(Service.price_usd))
        .join(Appointment, Service.id == Appointment.service_id)
        .filter(
            Appointment.freelancer_id == freelancer_id,
            Appointment.status == "confirmed",
        )
        .group_by(Service.name)
        .all()
    )
    revenue_chart_data = [
        {"service": name, "revenue": round(revenue or 0, 2)}
        for name, revenue in revenue_per_service
    ]

    return jsonify(
        {
            "total_bookings": total,
            "confirmed": confirmed,
            "cancelled": cancelled,
            "top_service": ", ".join(top_names) if top_names else None,
            "bookings_per_service": service_chart_data,
            "booking_trend": trend_data,
            "service_revenue": revenue_chart_data,
            "signup_date": Freelancer.query.get(freelancer_id).created_at.strftime(
                "%-m/%-d/%y"
            ),
        }
    )


@freelancer_bp.route("/freelancer/priority-support", methods=["POST"])
@require_auth
@require_tier("priority_support")
def send_priority_support_request():
    freelancer_id = int(get_jwt_identity())
    data = request.get_json()
    # Store raw text - plain text emails are XSS-safe
    subject = data.get("subject", "No Subject").strip()
    message = data.get("message", "").strip()

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404
    # if freelancer.tier != "elite":
    #     return jsonify({"error": "Only elite tier can access support"}), 403

    try:
        smtp_server = os.getenv("BREVO_SMTP_SERVER")
        smtp_port = int(os.getenv("BREVO_SMTP_PORT", 587))
        smtp_login = os.getenv("BREVO_SMTP_LOGIN")
        smtp_password = os.getenv("BREVO_SMTP_PASSWORD")
        support_email = os.getenv("SUPPORT_EMAIL")

        msg = MIMEMultipart()
        msg["From"] = smtp_login
        msg["To"] = support_email
        tier_prefix = freelancer.tier.upper() if freelancer.tier else "FREE"
        msg["Subject"] = f"[ELITE SUPPORT] {subject}"

        body = f"""
        Tier: {freelancer.tier}
        Name: {freelancer.first_name} {freelancer.last_name}
        Email: {freelancer.email}

        Message:
        {message}
        """

        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_login, smtp_password)
            server.sendmail(smtp_login, support_email, msg.as_string())

        return jsonify({"message": "Support request sent!"}), 200

    except Exception as e:
        print("❌ Support email failed:", str(e))
        return jsonify({"error": "Failed to send support email"}), 500


@freelancer_bp.route("/freelancer/reply", methods=["POST"])
@jwt_required()
def reply_to_customer():
    freelancer_id = int(get_jwt_identity())
    data = request.get_json()
    customer_email = data.get("to")
    # Store raw text - plain text emails are XSS-safe
    subject = data.get("subject", "Reply from SlotMe Support").strip()
    message = data.get("message", "").strip()

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer or freelancer.tier != "elite":
        return jsonify({"error": "Unauthorized"}), 403

    try:
        send_branded_customer_reply(subject, message, customer_email)
        return jsonify({"message": "Reply sent successfully!"}), 200
    except Exception as e:
        print("❌ Reply failed:", str(e))
        return jsonify({"error": "Failed to send reply"}), 500


@freelancer_bp.route("/freelancer/branding", methods=["PATCH"])
@require_auth
def update_freelancer_branding():
    print("🔥 Incoming PATCH payload:", request.json)
    data = request.get_json() or {}
    f = g.freelancer
    if not f:
        return jsonify({"error": "auth_required"}), 401

    # Store raw text - React escapes in UI, plain text emails are XSS-safe
    if "first_name" in data:
        f.first_name = data["first_name"].strip()
    if "last_name" in data:
        f.last_name = data["last_name"].strip()
    if "business_name" in data:
        f.business_name = data["business_name"].strip()
    if "business_address" in data:
        f.business_address = data["business_address"].strip()
    if "logo_url" in data:
        f.logo_url = data["logo_url"].strip()
    if "bio" in data:
        f.bio = data["bio"].strip()
    if "tagline" in data:
        f.tagline = data["tagline"].strip()
    if "timezone" in data:
        f.timezone = data["timezone"]
    if "no_show_policy" in data:
        f.no_show_policy = data["no_show_policy"].strip()
    if "location" in data:
        f.location = data["location"].strip()
    if "booking_instructions" in data:
        instructions = data["booking_instructions"]
        if isinstance(instructions, list):
            # Clean each instruction
            clean_instructions = []
            for item in instructions:
                if isinstance(item, str):
                    cleaned = item.strip()
                    if cleaned:  # Only keep non-empty
                        clean_instructions.append(cleaned)
            f.booking_instructions = clean_instructions
        elif isinstance(instructions, str):
            # Backwards compatibility: convert old string to array
            f.booking_instructions = (
                [instructions.strip()] if instructions.strip() else []
            )
        else:
            f.booking_instructions = []
    if "preferred_payment_methods" in data:
        f.preferred_payment_methods = data["preferred_payment_methods"].strip()
    if "contact_email" in data:
        f.contact_email = data["contact_email"].strip()
    if "business_phone" in data:
        f.business_phone = data["business_phone"].strip()
    if "instagram_url" in data:
        f.instagram_url = data["instagram_url"].strip()  # URL, validated elsewhere
    if "twitter_url" in data:
        f.twitter_url = data["twitter_url"].strip()  # URL, validated elsewhere

    # 🔥 FIX: FAQ structure - frontend sends "question"/"answer", NOT "q"/"a"
    if "faq_items" in data:
        faq_items = data["faq_items"]
        if isinstance(faq_items, list):
            clean_faq = []
            for item in faq_items:
                if isinstance(item, dict) and "question" in item and "answer" in item:
                    q = item["question"].strip()
                    a = item["answer"].strip()
                    if q and a:  # Only save non-empty FAQs
                        clean_faq.append({"question": q, "answer": a})
            f.faq_items = clean_faq
            print(f"💾 Saved {len(clean_faq)} FAQs")
        else:
            f.faq_items = []

    # --- custom_url: gate + validate + uniqueness ---
    if "custom_url" in data:
        current = (f.custom_url or "").strip().lower()
        proposed = re.sub(
            r"[^a-z0-9_-]", "", (data.get("custom_url") or "").strip().lower()
        )
        # If changing the slug, enforce feature gate
        if proposed != current:
            tier = (g.user or {}).get("tier", "free")
            if not is_feature_enabled("custom_url", tier):
                return (
                    jsonify(
                        {
                            "error": "upgrade_required",
                            "feature": "custom_url",
                            "required_tiers": ["pro", "elite"],
                        }
                    ),
                    403,
                )
        # Validate format (allow empty string to mean "clear it")
        if proposed and not re.match(r"^[a-z0-9_-]{3,30}$", proposed):
            return (
                jsonify({"error": "Custom URL must be 3-30 chars (a-z, 0-9, _ , -)"}),
                422,
            )
        # Uniqueness (only if actually changing & not empty)
        if proposed and proposed != current:
            if Freelancer.query.filter(Freelancer.custom_url == proposed).first():
                return jsonify({"error": "Custom URL is already taken."}), 422
        f.custom_url = proposed or None  # store as NULL if empty

    db.session.commit()
    print("✅ Branding updated successfully")
    return jsonify({"message": "Branding updated"}), 200


@freelancer_bp.route("/404")
def hardcoded_404():
    return jsonify({"error": "Not found"}), 404


@freelancer_bp.route("/freelancer-info", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@require_auth
def get_freelancer_info():
    # middleware already set g.freelancer and g.user
    f = g.freelancer
    if not f:
        return jsonify({"error": "auth_required"}), 401

    return (
        jsonify(
            {
                "id": f.id,
                "first_name": f.first_name,
                "last_name": f.last_name,
                "business_name": f.business_name,
                "logo_url": f.logo_url,
                "tagline": f.tagline,
                "bio": f.bio,
                "timezone": f.timezone,
                "business_address": f.business_address,
                "custom_url": f.custom_url,
                "public_slug": f.public_slug,
                "no_show_policy": f.no_show_policy,
                "faq_items": f.faq_items,
                "tier": f.tier,
                "is_verified": f.tier in ["pro", "elite"],
                "location": f.location,
                "booking_instructions": f.booking_instructions,
                "preferred_payment_methods": f.preferred_payment_methods,
                "show_footer_navbar": f.show_footer_navbar,
                "contact_email": f.contact_email,
                "phone": f.phone,  # Personal phone (for Settings page)
                "business_phone": f.business_phone,  # 🔥 NEW: Business phone (for Branding form)
                "instagram_url": f.instagram_url,
                "twitter_url": f.twitter_url,
            }
        ),
        200,
    )


@freelancer_bp.route("/<string:custom_url>", methods=["GET"])
def public_profile_by_url(custom_url):
    if custom_url in RESERVED_ROUTES:
        return handle_404(None)

    freelancer = Freelancer.query.filter_by(custom_url=custom_url.lower()).first()
    if not freelancer:
        return handle_404(None)

    services = Service.query.filter_by(
        freelancer_id=freelancer.id, is_enabled=True
    ).all()
    service_data = [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "duration_minutes": s.duration_minutes,
            "price_usd": s.price_usd or 0.0,
            "is_enabled": s.is_enabled,
        }
        for s in services
    ]

    return jsonify(
        {
            "id": freelancer.id,
            "first_name": freelancer.first_name,
            "last_name": freelancer.last_name,
            "email": freelancer.contact_email,
            "phone": freelancer.phone,
            "logo_url": freelancer.logo_url,
            "tagline": freelancer.tagline,
            "bio": freelancer.bio,
            "instagram_url": freelancer.instagram_url,
            "twitter_url": freelancer.twitter_url,
            "is_verified": freelancer.tier in ["pro", "elite"],
            "joined": freelancer.created_at.strftime("%-m/%-d/%y"),
            "services": service_data,
            "faq_items": freelancer.faq_items,
            "location": freelancer.location,
            "booking_instructions": freelancer.booking_instructions,
            "preferred_payment_methods": freelancer.preferred_payment_methods,
        }
    )


# ✅ Add these two new routes at the bottom of your `freelancer_bp` file
# PATCH /freelancer/account — update email, password, name, business_name, phone
# DELETE /freelancer/account — delete freelancer + optionally cancel subscription


@freelancer_bp.route("/freelancer/account", methods=["PATCH"])
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def update_account():
    freelancer_id = int(get_jwt_identity())
    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    data = request.get_json() or {}
    print("🛠️ Update account payload:", data)

    def is_valid_email(email):
        return re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email)

    def is_valid_phone(phone):
        return re.match(r"^\+?[0-9\s\-()]{7,20}$", phone)

    # Validate and update
    if "email" in data:
        email = data["email"].strip()
        if not is_valid_email(email):
            return jsonify({"error": "Invalid email format."}), 400
        freelancer.contact_email = email

    if "phone" in data:
        phone = data["phone"].strip()
        if not is_valid_phone(phone):
            return jsonify({"error": "Invalid phone number."}), 400
        freelancer.phone = phone

    # Store raw text - React escapes in UI, plain text emails are XSS-safe
    if "first_name" in data:
        freelancer.first_name = data["first_name"].strip()
    if "last_name" in data:
        freelancer.last_name = data["last_name"].strip()
    if "business_name" in data:
        freelancer.business_name = data["business_name"].strip()

    # 📱 UI Preferences
    if "show_footer_navbar" in data:
        freelancer.show_footer_navbar = bool(data["show_footer_navbar"])

    # 🔒 Custom URL gating (Pro/Elite only)
    if "custom_url" in data:
        custom_url = data["custom_url"].strip().lower()

        # Only Pro/Elite can set custom URLs
        if freelancer.tier not in ["pro", "elite"]:
            return (
                jsonify(
                    {
                        "error": "Custom URLs are a PRO/ELITE feature. Upgrade to set a custom URL."
                    }
                ),
                403,
            )

        # Validate format (alphanumeric + hyphens only)
        if custom_url and not re.match(r"^[a-z0-9-]+$", custom_url):
            return (
                jsonify(
                    {
                        "error": "Custom URL can only contain lowercase letters, numbers, and hyphens."
                    }
                ),
                400,
            )

        # Check if taken
        if custom_url:
            existing = Freelancer.query.filter_by(custom_url=custom_url).first()
            if existing and existing.id != freelancer_id:
                return jsonify({"error": "Custom URL already taken."}), 409

        freelancer.custom_url = custom_url if custom_url else None

    # Optional password update
    if "new_password" in data:
        new_password = data.get("new_password", "").strip()
        current_password = data.get("password", "").strip()

        if not current_password:
            return (
                jsonify(
                    {"error": "Current password is required to change your password."}
                ),
                400,
            )

        from werkzeug.security import check_password_hash

        if not check_password_hash(freelancer.password, current_password):
            return jsonify({"error": "Incorrect current password."}), 403

        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters."}), 400

        freelancer.password = generate_password_hash(new_password)

    db.session.commit()
    return jsonify({"message": "Account updated successfully."}), 200


@freelancer_bp.route("/freelancer/account", methods=["DELETE"])
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def delete_account():
    freelancer_id = int(get_jwt_identity())
    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    data = request.get_json() or {}
    password = data.get("password", "").strip()

    from werkzeug.security import check_password_hash

    if not password or not check_password_hash(freelancer.password, password):
        return jsonify({"error": "Invalid password"}), 403

    print(f"🧨 Deleting freelancer ID {freelancer.id} ({freelancer.email})")

    # ❗ Cancel active Stripe subscriptions (if any)
    if freelancer.stripe_customer_id:
        try:
            subs = stripe.Subscription.list(
                customer=freelancer.stripe_customer_id, status="active"
            )
            for sub in subs.auto_paging_iter():
                stripe.Subscription.delete(sub.id)
            try:
                stripe.Customer.delete(freelancer.stripe_customer_id)
            except Exception as e:
                print("⚠️ Failed to delete Stripe customer:", e)
        except Exception as e:
            print("⚠️ Failed to cancel Stripe subscription(s):", e)

    Service.query.filter_by(freelancer_id=freelancer.id).delete()
    Appointment.query.filter_by(freelancer_id=freelancer.id).delete()
    TimeSlot.query.filter_by(freelancer_id=freelancer.id).delete()

    db.session.delete(freelancer)
    db.session.commit()

    return jsonify({"message": "Freelancer account deleted."}), 200


@freelancer_bp.route("/freelancer/me", methods=["GET"])
@require_auth
def get_freelancer_profile():
    f = g.freelancer
    if not f:
        return jsonify({"error": "auth_required"}), 401

    print(
        "📡 ME ROUTE PAYLOAD =",
        {
            "id": f.id,
            "first_name": f.first_name,
            "last_name": f.last_name,
            "email": f.contact_email,
            "phone": f.phone,
            "business_name": f.business_name,
            "tier": f.tier,
            "show_footer_navbar": f.show_footer_navbar,
        },
    )

    return jsonify(
        {
            "id": f.id,
            "first_name": f.first_name,
            "last_name": f.last_name,
            "email": f.contact_email,
            "phone": f.phone,
            "business_name": f.business_name,
            "tier": f.tier,
            "show_footer_navbar": f.show_footer_navbar,
        }
    )


@freelancer_bp.route("/freelancer/questions/<identifier>", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def get_custom_questions(identifier):
    # 🔥 NEW: Priority lookup order (custom_url → public_slug → ID)
    if identifier.isdigit():
        freelancer = Freelancer.query.get(int(identifier))
    else:
        # Try custom_url first (paid tiers)
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()
        # Try public_slug second (all users)
        if not freelancer:
            freelancer = Freelancer.query.filter_by(
                public_slug=identifier.lower()
            ).first()

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    return jsonify(
        {
            "questions": freelancer.custom_questions or [],
            "enabled": freelancer.custom_questions_enabled,
        }
    )


@freelancer_bp.route("/freelancer/questions", methods=["PATCH"])
@require_auth
def update_custom_questions():
    data = request.get_json()
    questions = data.get("custom_questions", [])
    enabled = data.get("custom_questions_enabled", True)

    # optional validation: check structure
    if not isinstance(questions, list):
        return jsonify({"error": "Questions must be a list"}), 400

    # Store raw text - React escapes in UI, plain text emails are XSS-safe
    clean_questions = []
    for q in questions:
        if "question" not in q or not isinstance(q["question"], str):
            return (
                jsonify({"error": "Each question must include a 'question' field"}),
                400,
            )
        if "required" not in q or not isinstance(q["required"], bool):
            return (
                jsonify({"error": "Each question must include a 'required' boolean"}),
                400,
            )

        question_text = q["question"].strip()

        # Reject empty questions
        if not question_text:
            return (
                jsonify(
                    {
                        "error": "Custom questions cannot be empty. Please fill in all questions or remove them."
                    }
                ),
                422,
            )

        clean_questions.append({"question": question_text, "required": q["required"]})

    g.freelancer.custom_questions = clean_questions
    g.freelancer.custom_questions_enabled = enabled
    db.session.commit()
    return jsonify({"message": "Custom questions updated!"}), 200


@freelancer_bp.route("/freelancer/questions", methods=["GET"])
@require_auth
def get_own_custom_questions():
    return jsonify(
        {
            "questions": g.freelancer.custom_questions or [],
            "enabled": g.freelancer.custom_questions_enabled,
        }
    )


@freelancer_bp.route("/freelancer/batch-slots-v2", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
@jwt_required()
def create_batch_slots_v2():
    """
    FIXED: Batch slot creation with proper timezone-aware UTC storage
    """
    from models import MasterTimeSlot, TimeSlot
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo

    data = request.get_json()
    freelancer_id = get_jwt_identity()
    freelancer = Freelancer.query.get(freelancer_id)

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    start_day = data.get("start_day")  # LOCAL date
    end_day = data.get("end_day")  # LOCAL date
    start_time = data.get("start_time")  # LOCAL time like "09:00 AM"
    end_time = data.get("end_time")  # LOCAL time like "05:00 PM"
    interval = int(data.get("interval", 15))

    if not all([start_day, start_time, end_time]):
        return jsonify({"error": "Missing required fields"}), 400
    if interval < 15 or interval % 15 != 0:
        return jsonify({"error": "Interval must be a multiple of 15 minutes"}), 400

    master_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    label_to_master = {mt.label: mt for mt in master_times}

    try:
        # 🔥 FIX: Parse as LOCAL datetime in freelancer's timezone
        tz = ZoneInfo(freelancer.timezone)

        # Parse start and end as naive datetimes, then localize
        start_naive = datetime.strptime(
            f"{start_day} {start_time}", "%Y-%m-%d %I:%M %p"
        )
        end_naive = datetime.strptime(f"{end_day} {end_time}", "%Y-%m-%d %I:%M %p")

        # Make them timezone-aware in freelancer's timezone
        start_local = start_naive.replace(tzinfo=tz)
        end_local = end_naive.replace(tzinfo=tz)

        # Convert to UTC for iteration
        start_utc = start_local.astimezone(ZoneInfo("UTC"))
        end_utc = end_local.astimezone(ZoneInfo("UTC"))

        # 🔥 SAFETY FIX: handle UTC day rollover automatically
        if end_utc <= start_utc:
            end_utc += timedelta(days=1)
            print("🕐 Adjusted end_utc forward by one day (UTC day rollover detected)")

        created_slots = []
        current_utc = start_utc

        print(
            f"🌍 Creating slots from {start_local} ({freelancer.timezone}) to {end_local}"
        )
        print(f"   → UTC range: {start_utc} to {end_utc}")

        # Iterate through UTC times
        while current_utc < end_utc:
            utc_time_label = current_utc.strftime(
                "%I:%M %p"
            )  # 🔥 FIXED: Keep leading zero to match master times
            utc_day = current_utc.strftime("%Y-%m-%d")

            master_time = label_to_master.get(utc_time_label)
            if not master_time:
                current_utc += timedelta(minutes=interval)
                continue

            # 🔥 FIX: Check for duplicates within the SAME timezone only
            existing_slot = TimeSlot.query.filter_by(
                freelancer_id=freelancer_id,
                day=utc_day,
                master_time_id=master_time.id,
                timezone=freelancer.timezone,  # 🔥 ADD TIMEZONE TO DUPLICATE CHECK
            ).first()

            # If slot exists but has NULL timezone, update it to current timezone
            if existing_slot and not existing_slot.timezone:
                existing_slot.timezone = freelancer.timezone
                print(
                    f"🔄 Updated NULL timezone to {freelancer.timezone} for slot {existing_slot.id}"
                )

            if not existing_slot:
                new_slot = TimeSlot(
                    freelancer_id=freelancer_id,
                    day=utc_day,
                    master_time_id=master_time.id,
                    is_booked=False,
                    is_inherited_block=False,
                    timezone=freelancer.timezone,  # 🔥 FREEZE timezone at creation
                )
                db.session.add(new_slot)

                # Convert back to local for logging
                local_display = current_utc.astimezone(tz)
                created_slots.append(
                    {
                        "utc_day": utc_day,
                        "utc_time": utc_time_label,
                        "local_day": local_display.strftime("%Y-%m-%d"),
                        "local_time": local_display.strftime("%I:%M %p"),
                        "master_time_id": master_time.id,
                    }
                )
                print(
                    f"✅ CREATED: {utc_day} {utc_time_label} UTC (local: {local_display.strftime('%Y-%m-%d %I:%M %p %Z')})"
                )
            else:
                print(f"⏭️  EXISTS: {utc_day} {utc_time_label} UTC")

            current_utc += timedelta(minutes=interval)

        db.session.commit()
        print(f"🎉 Created {len(created_slots)} new slots")

        return (
            jsonify(
                {
                    "message": f"Created {len(created_slots)} slots",
                    "slots_created": [
                        {
                            **slot,
                            "id": TimeSlot.query.filter_by(
                                freelancer_id=freelancer_id,
                                day=slot["utc_day"],
                                master_time_id=slot["master_time_id"],
                            )
                            .first()
                            .id,
                        }
                        for slot in created_slots
                    ],
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        import traceback

        print("❌ ERROR in batch slot creation:")
        traceback.print_exc()
        return jsonify({"error": f"Slot creation failed: {str(e)}"}), 500


@freelancer_bp.route("/debug/time-matching", methods=["POST"])
@jwt_required()
def debug_time_matching():
    data = request.get_json()
    test_time = data.get("test_time", "9:00 AM")

    master_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    label_to_master = {mt.label: mt for mt in master_times}

    test_dt = datetime.strptime(test_time, "%I:%M %p")
    formats = [
        test_dt.strftime("%I:%M %p"),
        test_dt.strftime("%-I:%M %p"),
    ]

    results = {
        "input": test_time,
        "formats_tested": formats,
        "master_labels_sample": list(label_to_master.keys())[:10],
        "matches": [],
    }

    for fmt in formats:
        if fmt in label_to_master:
            results["matches"].append(
                {"format": fmt, "master_id": label_to_master[fmt].id, "found": True}
            )
        else:
            results["matches"].append({"format": fmt, "found": False})

    return jsonify(results)


@freelancer_bp.route("/freelancer/delete-initiate", methods=["POST"])
@jwt_required()
def delete_initiate():
    """Step 1: Verify credentials and send confirmation email"""
    freelancer_id = int(get_jwt_identity())
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    # Verify email matches
    if freelancer.email.lower() != email.lower():
        return jsonify({"error": "Email does not match account"}), 403

    # Verify password
    if not check_password_hash(freelancer.password, password):
        return jsonify({"error": "Incorrect password"}), 403

    # Generate deletion token (expires in 15 minutes)
    delete_token = str(uuid.uuid4())
    freelancer.delete_token = delete_token
    freelancer.delete_token_expiry = datetime.utcnow() + timedelta(minutes=15)
    db.session.commit()

    # Send confirmation email
    from email_utils import send_branded_customer_reply
    from config import FRONTEND_URL

    delete_url = f"{FRONTEND_URL}/delete-confirm/{delete_token}"
    subject = "⚠️ Confirm SlotMe Account Deletion"
    body = (
        f"Hi {freelancer.first_name},\n\n"
        "You requested to permanently delete your SlotMe account.\n\n"
        f"To confirm this action, click the link below within 15 minutes:\n\n"
        f"{delete_url}\n\n"
        "⚠️ THIS CANNOT BE UNDONE. All your data will be permanently deleted:\n"
        "• All time slots and availability\n"
        "• All appointments and booking history\n"
        "• All services and settings\n"
        "• Your profile and business info\n"
        "• Any active Stripe subscriptions\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "- SlotMe Team"
    )

    send_branded_customer_reply(subject, body, freelancer.email)

    print(f"🗑️ Delete token generated for freelancer {freelancer_id}")
    return (
        jsonify({"message": "Confirmation email sent. Link expires in 15 minutes."}),
        200,
    )


@freelancer_bp.route("/freelancer/delete-confirm/<token>", methods=["GET", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def delete_confirm(token):
    """Step 2: Validate token from email link"""
    freelancer = Freelancer.query.filter_by(delete_token=token).first()

    if not freelancer:
        return jsonify({"error": "Invalid or already used token"}), 404

    # Check expiration
    if datetime.utcnow() > freelancer.delete_token_expiry:
        return jsonify({"error": "Token expired"}), 400

    print(f"✅ Delete token validated for freelancer {freelancer.id}")
    return (
        jsonify(
            {
                "message": "Token valid",
                "freelancer": {
                    "first_name": freelancer.first_name,
                    "email": freelancer.email,
                },
            }
        ),
        200,
    )


@freelancer_bp.route("/freelancer/delete-finalize/<token>", methods=["POST", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def delete_finalize(token):
    """Step 3: Actually delete the account"""
    if request.method == "OPTIONS":
        return jsonify({}), 200

    freelancer = Freelancer.query.filter_by(delete_token=token).first()

    if not freelancer:
        return jsonify({"error": "Invalid or already used token"}), 404

    # Check expiration
    if datetime.utcnow() > freelancer.delete_token_expiry:
        return jsonify({"error": "Token expired"}), 400

    freelancer_id = freelancer.id
    tier = freelancer.tier
    email = freelancer.email

    # 🔥 Cancel Stripe subscription BEFORE deleting account
    if tier in ["pro", "elite"]:
        subscription_id = freelancer.stripe_subscription_id
        customer_id = freelancer.stripe_customer_id

        # Try to cancel using subscription_id (preferred)
        if subscription_id:
            try:
                from utils.stripe_utils import cancel_subscription

                cancel_subscription(subscription_id)
                print(
                    f"✅ Stripe subscription {subscription_id} cancelled for freelancer {freelancer_id}"
                )

                # Downgrade tier before deletion for consistency
                freelancer.tier = "free"
                freelancer.stripe_subscription_id = None
                db.session.commit()

            except Exception as e:
                print(f"❌ Failed to cancel Stripe subscription: {e}")
                # FAIL CLOSED: Don't delete if we can't cancel subscription
                return (
                    jsonify(
                        {
                            "error": "Failed to cancel Stripe subscription. Please contact support.",
                            "details": str(e),
                        }
                    ),
                    500,
                )

        # Fallback: try to find and cancel by customer_id (for legacy accounts)
        elif customer_id:
            try:
                from utils.stripe_utils import (
                    get_active_subscription_for_customer,
                    cancel_subscription,
                )

                found_sub_id = get_active_subscription_for_customer(customer_id)
                if found_sub_id:
                    cancel_subscription(found_sub_id)
                    print(
                        f"✅ Found and cancelled subscription {found_sub_id} via customer lookup"
                    )

                    freelancer.tier = "free"
                    db.session.commit()
                else:
                    print(f"⚠️  No active subscription found for customer {customer_id}")
                    # Continue to deletion since no active sub exists

            except Exception as e:
                print(f"❌ Failed to cancel subscription via customer lookup: {e}")
                return (
                    jsonify(
                        {
                            "error": "Failed to cancel Stripe subscription. Please contact support.",
                            "details": str(e),
                        }
                    ),
                    500,
                )

    # Delete all related records (cascade handles most of this)
    try:
        db.session.delete(freelancer)
        db.session.commit()

        print(
            f"🗑️ Account successfully deleted for Freelancer ID {freelancer_id} ({email})"
        )
        return jsonify({"message": "Account successfully deleted"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Failed to delete account: {e}")
        return jsonify({"error": "Failed to delete account"}), 500


# ========== SERVICE ADD-ONS ==========


@freelancer_bp.route("/freelancer/addons", methods=["GET", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def get_addons():
    if request.method == "OPTIONS":
        return "", 200
    freelancer_id = int(get_jwt_identity())
    addons = ServiceAddon.query.filter_by(freelancer_id=freelancer_id).all()
    return jsonify(
        [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description,
                "price_usd": a.price_usd,
                "duration_minutes": a.duration_minutes,
                "is_enabled": a.is_enabled,  # ✅ NEW
            }
            for a in addons
        ]
    )


@freelancer_bp.route("/freelancer/addons", methods=["POST", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def add_addon():
    if request.method == "OPTIONS":
        return "", 200
    freelancer_id = int(get_jwt_identity())
    
    # ✅ TIER GATE: Check freelancer tier and addon count
    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404
    
    tier = (freelancer.tier or "free").lower()
    current_addon_count = ServiceAddon.query.filter_by(freelancer_id=freelancer_id).count()
    
    # FREE: No add-ons allowed
    if tier == "free":
        return jsonify({
            "error": "Add-ons require PRO or ELITE. Upgrade to unlock this feature.",
            "tier_required": "pro"
        }), 403
    
    # PRO: Max 5 add-ons
    if tier == "pro" and current_addon_count >= 5:
        return jsonify({
            "error": "PRO tier is limited to 5 add-ons. Upgrade to ELITE for unlimited.",
            "tier_required": "elite",
            "current_count": current_addon_count,
            "limit": 5
        }), 403
    
    # ELITE: Unlimited (no check needed)
    
    data = request.get_json()
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    if len(description) > 500:
        return jsonify({"error": "Description too long (500 char max)"}), 422
    price_raw = data.get("price_usd")
    duration_raw = data.get("duration_minutes", 0)
    if not name:
        return jsonify({"error": "Name is required"}), 422
    try:
        price_usd = float(price_raw)
        if price_usd < 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid price"}), 422
    try:
        duration_minutes = int(duration_raw)
        if duration_minutes < 0 or duration_minutes % 15 != 0:
            raise ValueError
    except (ValueError, TypeError):
        return (
            jsonify({"error": "Invalid duration — must be a multiple of 15 or 0"}),
            422,
        )
    addon = ServiceAddon(
        freelancer_id=freelancer_id,
        name=name,
        description=description,
        price_usd=price_usd,
        duration_minutes=duration_minutes,
    )
    db.session.add(addon)
    db.session.commit()
    return jsonify({
        "id": addon.id,
        "name": addon.name,
        "description": addon.description,
        "price_usd": addon.price_usd,
        "duration_minutes": addon.duration_minutes,
        "is_enabled": addon.is_enabled
    }), 201


@freelancer_bp.route("/freelancer/addons/<int:addon_id>", methods=["PATCH", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def update_addon(addon_id):
    if request.method == "OPTIONS":
        return "", 200
    freelancer_id = int(get_jwt_identity())
    addon = ServiceAddon.query.filter_by(
        id=addon_id, freelancer_id=freelancer_id
    ).first()
    if not addon:
        return jsonify({"error": "Add-on not found"}), 404
    data = request.json
    if "name" in data:
        addon.name = data["name"].strip()
    if "description" in data:
        addon.description = data["description"].strip()
    if "price_usd" in data:
        addon.price_usd = float(data["price_usd"])
    if "duration_minutes" in data:
        addon.duration_minutes = int(data["duration_minutes"])
    # ✅ NEW: Enable/disable toggle
    if "is_enabled" in data:
        addon.is_enabled = bool(data["is_enabled"])
    db.session.commit()
    return jsonify({
        "id": addon.id,
        "name": addon.name,
        "description": addon.description,
        "price_usd": addon.price_usd,
        "duration_minutes": addon.duration_minutes,
        "is_enabled": addon.is_enabled
    })


@freelancer_bp.route("/freelancer/addons/<int:addon_id>", methods=["DELETE", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, headers=["Content-Type", "Authorization"])
@jwt_required()
def delete_addon(addon_id):
    if request.method == "OPTIONS":
        return "", 200

    freelancer_id = int(get_jwt_identity())
    addon = ServiceAddon.query.filter_by(
        id=addon_id, freelancer_id=freelancer_id
    ).first()

    if not addon:
        return jsonify({"error": "Add-on not found"}), 404

    db.session.delete(addon)
    db.session.commit()

    return jsonify({"message": "Add-on deleted"}), 200


@freelancer_bp.route("/freelancer/addons/<identifier>", methods=["GET", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def get_public_addons(identifier):
    """Public route for customers to see available add-ons"""
    if request.method == "OPTIONS":
        return jsonify({}), 200
    # 🔥 Priority lookup order (same as services)
    if identifier.isdigit():
        freelancer_id = int(identifier)
    else:
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()
        if not freelancer:
            freelancer = Freelancer.query.filter_by(
                public_slug=identifier.lower()
            ).first()
        if not freelancer:
            return jsonify({"error": "Freelancer not found"}), 404
        freelancer_id = freelancer.id
    # ✅ FILTER: Only show enabled add-ons to customers
    addons = ServiceAddon.query.filter_by(
        freelancer_id=freelancer_id, is_enabled=True
    ).all()
    return jsonify(
        [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description,
                "price_usd": a.price_usd,
                "duration_minutes": a.duration_minutes,
            }
            for a in addons
        ]
    )
