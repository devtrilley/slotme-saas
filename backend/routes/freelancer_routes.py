from flask import Blueprint, make_response, Response, request, jsonify, g
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
from werkzeug.security import generate_password_hash
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

    if identifier.isdigit():
        freelancer_id = int(identifier)
    else:
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()
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
        .all()
    )

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
            }
        )

    return jsonify(result)


@freelancer_bp.route("/freelancer/public-info/<identifier>", methods=["GET", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def get_public_freelancer_info(identifier):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    freelancer = None
    if identifier.isdigit():
        freelancer = Freelancer.query.get(int(identifier))
    else:
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()
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
            "logo_url": freelancer.logo_url,
            "tagline": freelancer.tagline,
            "bio": freelancer.bio,
            "faq_items": freelancer.faq_items,
            "timezone": freelancer.timezone,
            "is_verified": freelancer.tier in ["pro", "elite"],
            "email": freelancer.contact_email,
            "phone": freelancer.phone,
            "instagram_url": freelancer.instagram_url,
            "twitter_url": freelancer.twitter_url,
            "no_show_policy": freelancer.no_show_policy,
            "created_at": (
                freelancer.created_at.isoformat() if freelancer.created_at else None
            ),
            "tier": freelancer.tier,
            "services": service_data,  # ✅ ADD THIS
            "location": freelancer.location,
            "booking_instructions": freelancer.booking_instructions,
            "preferred_payment_methods": freelancer.preferred_payment_methods,
        }
    )


@freelancer_bp.route("/freelancers/<identifier>", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS)
def public_freelancer_profile(identifier):
    if identifier.isdigit():
        freelancer = Freelancer.query.get(int(identifier))
    else:
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()

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
            "email": freelancer.contact_email,  # <-- This one if you're using a separate public email
            "phone": freelancer.phone,
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
    service.name = data.get("name", service.name)
    service.description = data.get("description", service.description)
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
    subject = data.get("subject", "No Subject")
    message = data.get("message", "")

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
    subject = data.get("subject", "Reply from SlotMe Support")
    message = data.get("message", "")

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
# @require_tier("custom_url")
def update_freelancer_branding():
    print("🔥 Incoming PATCH payload:", request.json)
    data = request.get_json() or {}
    f = g.freelancer
    if not f:
        return jsonify({"error": "auth_required"}), 401

    # --- allowlist updates (prevents sneaky field writes) ---
    f.first_name = data.get("first_name", f.first_name)
    f.last_name = data.get("last_name", f.last_name)
    f.business_name = data.get("business_name", f.business_name)
    f.business_address = data.get("business_address", f.business_address)
    f.logo_url = data.get("logo_url", f.logo_url)
    f.bio = data.get("bio", f.bio)
    f.tagline = data.get("tagline", f.tagline)
    f.timezone = data.get("timezone", f.timezone)
    f.no_show_policy = data.get("no_show_policy", f.no_show_policy)
    if "faq_items" in data:
        f.faq_items = data["faq_items"]

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

        f.custom_url = proposed  # can be "" to clear

    db.session.commit()
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
                "no_show_policy": f.no_show_policy,
                "faq_items": f.faq_items,
                "tier": f.tier,
                "is_verified": f.tier in ["pro", "elite"],
                "location": f.location,
                "booking_instructions": f.booking_instructions,
                "preferred_payment_methods": f.preferred_payment_methods,
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

    if "first_name" in data:
        freelancer.first_name = data["first_name"].strip()

    if "last_name" in data:
        freelancer.last_name = data["last_name"].strip()

    if "business_name" in data:
        freelancer.business_name = data["business_name"].strip()

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
        }
    )


@freelancer_bp.route("/freelancer/questions/<identifier>", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def get_custom_questions(identifier):
    freelancer = None
    if identifier.isdigit():
        freelancer = Freelancer.query.get(int(identifier))
    else:
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()

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

    g.freelancer.custom_questions = questions
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

        created_slots = []
        current_utc = start_utc

        print(
            f"🌍 Creating slots from {start_local} ({freelancer.timezone}) to {end_local}"
        )
        print(f"   → UTC range: {start_utc} to {end_utc}")

        # Iterate through UTC times
        while current_utc < end_utc:
            utc_time_label = current_utc.strftime("%I:%M %p")
            utc_day = current_utc.strftime("%Y-%m-%d")

            master_time = label_to_master.get(utc_time_label)
            if not master_time:
                current_utc += timedelta(minutes=interval)
                continue

            # Check if slot already exists
            existing_slot = TimeSlot.query.filter_by(
                freelancer_id=freelancer_id,
                day=utc_day,  # 🔥 STORE UTC DATE
                master_time_id=master_time.id,
            ).first()

            if not existing_slot:
                new_slot = TimeSlot(
                    freelancer_id=freelancer_id,
                    day=utc_day,  # 🔥 STORE UTC DATE
                    master_time_id=master_time.id,
                    is_booked=False,
                    is_inherited_block=False,
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
