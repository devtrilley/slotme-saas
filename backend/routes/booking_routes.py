# backend/routes/booking_routes.py

import os
from flask import Blueprint, request, jsonify, Response, g
from flask_jwt_extended import jwt_required, get_jwt_identity

# Import zoneinfo and datetime at the top of the file
from zoneinfo import ZoneInfo
from datetime import datetime, time as dt_time
from sqlalchemy import and_
from config import name_pool, ip_attempts

import time, re
from flask_cors import cross_origin
from models import db, Appointment, Freelancer, TimeSlot, MasterTimeSlot, User, Service
from email_utils import send_branded_customer_reply
from itsdangerous import URLSafeTimedSerializer
from config import BACKEND_ORIGIN, ALLOWED_ORIGINS
from flask import current_app as app
from datetime import datetime, timezone

from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from config import FRONTEND_URL
from flask import redirect

from flask import make_response
import pytz
from datetime import timedelta

from services.booking_service import clear_inherited_blocks
from utils.decorators import require_auth, require_tier

from datetime import datetime, timezone, timedelta
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from config import (
    name_pool,
    ip_attempts,
    BACKEND_ORIGIN,
    ALLOWED_ORIGINS,
    FRONTEND_URL,
)
import os, time, re
from flask import (
    Blueprint,
    request,
    jsonify,
    Response,
    g,
    redirect,
    make_response,
    current_app as app,
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Appointment, Freelancer, TimeSlot, MasterTimeSlot, User, Service
from email_utils import send_branded_customer_reply
from services.booking_service import clear_inherited_blocks
from utils.decorators import require_auth

serializer = URLSafeTimedSerializer(os.environ.get("SECRET_KEY"))


booking_bp = Blueprint("booking", __name__)


@booking_bp.route("/book", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS)
def book_slot():
    data = request.get_json()
    print(f"🔥 Incoming payload: {data}")

    # Honeypot Strict Trap — Block any non-empty website field
    honeypot = str(data.get("website", "")).strip()
    if honeypot:
        return jsonify({"error": "Spam detected"}), 400

    # Expected fields only
    HUMAN_FIELDS = {
        "first_name",
        "last_name",
        "email",
        "phone",
        "slot_id",
        "service_id",
        "website",  # explicitly allowed
        "custom_responses",
        "customer_timezone",
    }

    # Dynamic trap — Any extra unexpected field triggers block if filled
    unexpected = [key for key in data.keys() if key not in HUMAN_FIELDS]
    for key in unexpected:
        if str(data.get(key, "")).strip():
            return jsonify({"error": "Spam detected"}), 400

    client_ip = request.remote_addr
    now = time.time()
    window = 180 if app.debug else 600  # IP TEST: 3 min dev, 10 min prod

    # Clean expired booking logs
    ip_attempts[client_ip] = [
        ts for ts in ip_attempts.get(client_ip, []) if now - ts < window
    ]

    if app.debug:
        print(
            f"📊 IP {client_ip} booking attempts: {len(ip_attempts.get(client_ip, []))} / 2 allowed within {window} sec window."
        )

    # Block after 2 successful bookings from same IP in window
    if len(ip_attempts[client_ip]) >= 2:
        return (
            jsonify(
                {
                    "error": "You're booking too fast — please wait a few moments before trying again."
                }
            ),
            429,
        )

    # # 🛡️ Honeypot Silent Bot Trap (Dynamic Field + Extra Key Detection)
    # HUMAN_FIELDS = {
    #     "first_name",
    #     "last_name",
    #     "email",
    #     "phone",
    #     "slot_id",
    #     "service_id",
    #     "custom_responses",
    # }

    # # Separate unexpected keys
    # unexpected = [key for key in data.keys() if key not in HUMAN_FIELDS]

    # # Classic fixed trap for legacy bots
    # if data.get("website"):
    #     return jsonify({"error": "Spam detected"}), 400

    # # Dynamic trap — ANY extra field with value = bot
    # for key in unexpected:
    #     if data.get(key):
    #         return jsonify({"error": "Spam detected"}), 400

    # Store raw text - React escapes in UI, plain text emails are XSS-safe
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    slot_id = data.get("slot_id")
    service_id = data.get("service_id")

    # Store custom responses as-is - React handles escaping
    custom_responses = data.get("custom_responses", {})
    if not isinstance(custom_responses, dict):
        custom_responses = {}

    # Validate required fields
    if not first_name or not last_name or not email or not slot_id or not service_id:
        return jsonify({"error": "Missing required fields"}), 400

    # Simple but effective email format check
    email_regex = r"^[\w\.-]+@[\w\.-]+\.[A-Za-z]{2,}$"
    if not re.match(email_regex, email):
        return jsonify({"error": "Invalid email format"}), 400

    slot = TimeSlot.query.get(slot_id)
    if not slot:
        return jsonify({"error": "Slot is unavailable"}), 400

    # 🔥 CRITICAL: Check if slot is already booked
    if slot.is_booked:
        return jsonify({"error": "Slot is unavailable"}), 400

    service = Service.query.get(service_id)
    if not service:
        return jsonify({"error": "Invalid service selected"}), 400

    # Prepare time label logic BEFORE conflict check
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]

    duration_blocks = service.duration_minutes // 15
    start_label = slot.master_time.label

    try:
        start_index = time_labels.index(start_label)
    except ValueError:
        return jsonify({"error": "Invalid slot time"}), 400

    required_labels = time_labels[start_index : start_index + duration_blocks]
    # Allow end-of-day partial bookings
    if len(required_labels) < duration_blocks:
        remaining_labels = time_labels[start_index:]
        if len(remaining_labels) < 1:
            return jsonify({"error": "Invalid slot time"}), 400
        required_labels = remaining_labels

    # ✅ Conflict check
    confirmed_conflict = (
        Appointment.query.join(TimeSlot)
        .join(MasterTimeSlot)
        .filter(
            Appointment.freelancer_id == slot.freelancer_id,
            Appointment.status == "confirmed",
            TimeSlot.day == slot.day,
            MasterTimeSlot.label.in_(required_labels),
        )
        .first()
    )

    if confirmed_conflict:
        return jsonify({"error": "Slot is unavailable"}), 400

    user = User.query.filter_by(email=email).first()
    if user:
        user.first_name = first_name
        user.last_name = last_name
        user.phone = phone  # optional: keep most recent phone
    else:
        user = User(
            first_name=first_name, last_name=last_name, email=email, phone=phone
        )
        db.session.add(user)

    db.session.commit()

    # 🛡️ Prevent duplicate booking for exact same slot
    duplicate_slot = Appointment.query.filter(
        Appointment.user_id == user.id,
        Appointment.freelancer_id == slot.freelancer_id,
        Appointment.slot_id == slot_id,
        Appointment.status.in_(["pending", "confirmed"]),
    ).first()

    if duplicate_slot:
        return (
            jsonify(
                {
                    "error": "You already have a booking for this time slot.",
                    "appointment_id": duplicate_slot.id,
                    "status": duplicate_slot.status,
                }
            ),
            400,
        )

    # 🛡️ Prevent abuse: max 3 bookings per email per day per freelancer
    same_day_bookings = (
        Appointment.query.filter(
            Appointment.user_id == user.id,
            Appointment.freelancer_id == slot.freelancer_id,
            Appointment.status.in_(["pending", "confirmed"]),
        )
        .join(TimeSlot)
        .filter(TimeSlot.day == slot.day)
        .count()
    )

    if same_day_bookings >= 3:
        return (
            jsonify(
                {
                    "error": "Maximum 3 bookings per day with this freelancer. Please contact them directly for additional sessions."
                }
            ),
            400,
        )

    # required_labels already computed earlier — reuse them
    # all_times, time_labels also already loaded

    # Check for any conflicting bookings across the entire service duration
    user_appointments = (
        Appointment.query.join(TimeSlot)
        .join(MasterTimeSlot)
        .filter(
            Appointment.user_id == user.id,
            Appointment.freelancer_id == slot.freelancer_id,
            Appointment.status != "cancelled",
            TimeSlot.day == slot.day,
        )
        .all()
    )

    for appt in user_appointments:
        appt_start = appt.slot.master_time.label
        appt_duration = appt.service.duration_minutes // 15
        try:
            appt_index = time_labels.index(appt_start)
            appt_labels = time_labels[appt_index : appt_index + appt_duration]
            if any(lbl in appt_labels for lbl in required_labels):
                return (
                    jsonify(
                        {
                            "error": "You already have a booking that conflicts with this time."
                        }
                    ),
                    400,
                )
        except ValueError:
            continue

    freelancer = Freelancer.query.get(slot.freelancer_id)

    appointment = Appointment(
        slot_id=slot_id,
        freelancer_id=slot.freelancer_id,
        user_id=user.id,
        service_id=service_id,
        status="pending",
        email=email,
        phone=phone,
        timestamp=datetime.now(timezone.utc),
        custom_responses=custom_responses,
        freelancer_timezone=slot.timezone
        or freelancer.timezone,  # 🔥 Use slot's frozen timezone
    )
    db.session.add(appointment)

    # Do NOT book slots yet — booking finalizes after confirmation
    # Only inherited blocks get flagged visually for pending UX clarity
    for i, label in enumerate(required_labels):
        mt = next((m for m in all_times if m.label == label), None)
        if not mt:
            continue
        s = TimeSlot.query.filter_by(
            day=slot.day,
            freelancer_id=slot.freelancer_id,
            master_time_id=mt.id,
        ).first()
        if s:
            s.is_inherited_block = i != 0  # Only inherited blocks flagged

    db.session.commit()

    from email_utils import (
        send_branded_customer_reply,
    )  # ✅ make sure this is at the top

    token = serializer.dumps({"appointment_id": appointment.id}, salt="booking-confirm")
    link = f"{BACKEND_ORIGIN}/confirm-booking/{token}"

    subject = f"Confirm Your Appointment – {freelancer.business_name or freelancer.first_name}"

    # Format appointment info for clarity
    from zoneinfo import ZoneInfo

    slot_tz = ZoneInfo(slot.timezone or freelancer.timezone or "America/New_York")
    slot_date = datetime.strptime(slot.day, "%Y-%m-%d").date()
    utc_time = datetime.strptime(slot.master_time.time_24h, "%H:%M").time()
    utc_dt = datetime.combine(slot_date, utc_time).replace(tzinfo=ZoneInfo("UTC"))
    local_dt = utc_dt.astimezone(slot_tz)
    local_time_display = local_dt.strftime("%I:%M %p").lstrip("0")
    timezone_abbr = local_dt.tzname()
    local_date_display = local_dt.strftime("%A, %B %d, %Y")

    # Format price for initial email
    price_display = f"${service.price_usd:.2f}" if service.price_usd else "Free"

    body = f"""Hi {first_name},
Thanks for booking with SlotMe! You're one step away from confirming your appointment.

⏰ IMPORTANT: This confirmation link expires in 15 minutes!
Please confirm now to secure your appointment.

📋 Service: {service.name}
💰 Price: {price_display}
⏱️ Duration: {service.duration_minutes} minutes
🗓️ Date: {local_date_display}
⏰ Time: {local_time_display} {timezone_abbr}
👤 With: {freelancer.first_name} {freelancer.last_name}
🏢 Business: {freelancer.business_name or "N/A"}

✅ Confirm your booking here:
{link}

If you didn't request this, feel free to ignore it.

– The SlotMe Team
https://slotme.xyz
"""

    ip_attempts.setdefault(client_ip, []).append(now)  # Count all booking attempts

    try:
        send_branded_customer_reply(subject, body, email)
    except Exception as e:
        db.session.delete(appointment)  # Undo pending booking
        db.session.commit()
        print(f"❌ Failed to send booking confirmation email to {email}: {e}")
        return (
            jsonify({"error": "Failed to send confirmation email. Please try again."}),
            500,
        )

    return (
        jsonify(
            {"message": "Verification email sent.", "appointment_id": appointment.id}
        ),
        200,
    )


@booking_bp.route("/confirm-booking/<token>", methods=["GET"])
@cross_origin(origins="*")
def confirm_booking_email(token):
    try:
        # data = serializer.loads(
        #     token, salt="booking-confirm", max_age=60
        # )  # 60 sec for testing
        data = serializer.loads(
            token, salt="booking-confirm", max_age=900
        )  # 15 minutes for prod
        appointment_id = data["appointment_id"]
    except SignatureExpired:
        # Extract freelancer slug even from expired token
        try:
            expired_data = serializer.loads(token, salt="booking-confirm", max_age=None)
            appt = Appointment.query.get(expired_data.get("appointment_id"))
            if appt and appt.freelancer:
                freelancer = appt.freelancer
                # Priority: custom_url → public_slug → numeric ID
                slug = freelancer.custom_url or freelancer.public_slug
                if slug:
                    return redirect(f"{FRONTEND_URL}/expired?slug={slug}")
                else:
                    # Fallback to numeric ID if no slug exists
                    return redirect(
                        f"{FRONTEND_URL}/expired?freelancer_id={freelancer.id}"
                    )
        except:
            pass
        return redirect(f"{FRONTEND_URL}/expired")
    except BadSignature:
        return redirect(f"{FRONTEND_URL}/invalid")

    appointment = Appointment.query.get(appointment_id)

    if not appointment:
        return redirect(f"{FRONTEND_URL}/invalid")

    # 🔥 IDEMPOTENT: If already confirmed, just show confirmed page again
    if appointment.status == "confirmed":
        return redirect(
            f"{FRONTEND_URL}/booking-confirmed?appointment_id={appointment.id}"
        )

    # If cancelled, show appropriate message
    if appointment.status == "cancelled":
        return redirect(f"{FRONTEND_URL}/booking-cancelled")

    # Only process if status is "pending"
    if appointment.status == "pending":
        slot = appointment.slot

        # 🔥 FIX #7: Check if slot time has already passed (using appointment's frozen timezone)
        from zoneinfo import ZoneInfo

        freelancer = appointment.freelancer
        # Use the appointment's frozen timezone, not freelancer's current timezone
        appointment_tz = ZoneInfo(appointment.freelancer_timezone or "America/New_York")

        # Parse slot datetime in UTC, then convert to appointment's timezone
        slot_date = datetime.strptime(slot.day, "%Y-%m-%d").date()
        utc_time = datetime.strptime(slot.master_time.time_24h, "%H:%M").time()
        slot_utc_dt = datetime.combine(slot_date, utc_time).replace(
            tzinfo=ZoneInfo("UTC")
        )
        slot_local_dt = slot_utc_dt.astimezone(appointment_tz)

        # Get current time in appointment's timezone
        now_local = datetime.now(appointment_tz)

        # If slot time has passed, reject confirmation
        if now_local >= slot_local_dt:
            print(f"⏰ Slot time has passed. Slot: {slot_local_dt}, Now: {now_local}")
            slug = freelancer.custom_url or freelancer.public_slug
            if slug:
                return redirect(
                    f"{FRONTEND_URL}/expired?slug={slug}&reason=time_passed"
                )
            else:
                return redirect(
                    f"{FRONTEND_URL}/expired?freelancer_id={freelancer.id}&reason=time_passed"
                )

        # Load all master times and compute required labels FIRST
        all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
        time_labels = [t.label for t in all_times]

        duration_blocks = appointment.service.duration_minutes // 15
        start_label = slot.master_time.label

        try:
            start_index = time_labels.index(start_label)
        except ValueError:
            return redirect(f"{FRONTEND_URL}/invalid")

        required_labels = time_labels[start_index : start_index + duration_blocks]

        if len(required_labels) < duration_blocks:
            remaining_labels = time_labels[start_index:]
            if len(remaining_labels) < 1:
                return redirect(f"{FRONTEND_URL}/invalid")
            required_labels = remaining_labels

        # ✅ Check all inherited blocks for conflicts BEFORE confirming
        for label in required_labels:
            mt = next((m for m in all_times if m.label == label), None)
            if not mt:
                continue
            s = TimeSlot.query.filter_by(
                day=slot.day,
                freelancer_id=slot.freelancer_id,
                master_time_id=mt.id,
            ).first()
            if s and s.is_booked:
                return redirect(
                    f"{FRONTEND_URL}/already-taken?freelancer_id={slot.freelancer_id}"
                )

        # No conflicts, safe to confirm
        import uuid

        appointment.status = "confirmed"

        # ✅ Add this if it's missing
        if not appointment.cancel_token:
            appointment.cancel_token = str(uuid.uuid4())
        slot.is_booked = True

        # Book inherited blocks properly
        for label in required_labels:
            mt = next((m for m in all_times if m.label == label), None)
            if not mt:
                continue
            s = TimeSlot.query.filter_by(
                day=slot.day,
                freelancer_id=slot.freelancer_id,
                master_time_id=mt.id,
            ).first()
            if s:
                s.is_booked = True
                s.is_inherited_block = label != start_label

        db.session.commit()

        # ✅ Send confirmation receipt email
        user = appointment.user
        freelancer = appointment.freelancer
        service = appointment.service

        formatted_date = datetime.strptime(slot.day, "%Y-%m-%d").strftime(
            "%A, %B %d, %Y"
        )
        formatted_time = slot.master_time.label

        naive_start = datetime.strptime(
            f"{slot.day} {slot.master_time.time_24h}", "%Y-%m-%d %H:%M"
        )
        utc_start = naive_start.replace(tzinfo=timezone.utc)
        utc_end = utc_start + timedelta(minutes=service.duration_minutes)

        start_str = utc_start.strftime("%Y%m%dT%H%M%SZ")
        end_str = utc_end.strftime("%Y%m%dT%H%M%SZ")

        title = f"{freelancer.business_name or 'Appointment'} with {user.first_name}"
        details = f"Service: {service.name}\\nBooked via SlotMe"
        location = freelancer.business_address or "Online"

        calendar_url = (
            "https://calendar.google.com/calendar/render?action=TEMPLATE"
            f"&text={title}&dates={start_str}/{end_str}&details={details}&location={location}"
        )

        # ✅ Send timezone-aware confirmation email to CUSTOMER
        try:
            from services.email_service import send_booking_confirmation_email

            send_booking_confirmation_email(
                appointment, customer_timezone=freelancer.timezone
            )
        except Exception as e:
            print(f"⚠️ Failed to send customer confirmation email: {e}")
            # Don't fail the confirmation if email fails

        # 🔥 NEW: Send notification email to FREELANCER
        try:
            from services.email_service import send_freelancer_booking_notification

            send_freelancer_booking_notification(appointment)
        except Exception as e:
            print(f"⚠️ Failed to send freelancer notification email: {e}")
            # Don't fail the confirmation if email fails

        return redirect(
            f"{FRONTEND_URL}/booking-confirmed?appointment_id={appointment.id}"
        )

    # Fallback for any other unexpected status
    return redirect(f"{FRONTEND_URL}/invalid")


@booking_bp.route("/download-ics/<int:appointment_id>")
@cross_origin(origins=ALLOWED_ORIGINS)
def download_ics(appointment_id):
    appt = Appointment.query.get(appointment_id)
    if not appt:
        return jsonify({"error": "Not found"}), 404

    user = appt.user
    freelancer = appt.freelancer
    service = appt.service
    slot = appt.slot

    # ✅ Parse UTC time correctly
    naive_start = datetime.strptime(
        f"{slot.day} {slot.master_time.time_24h}", "%Y-%m-%d %H:%M"
    )
    utc_start = naive_start.replace(tzinfo=timezone.utc)
    utc_end = utc_start + timedelta(minutes=service.duration_minutes)

    # ✅ Format for ICS with proper UTC timezone
    start_utc_str = utc_start.strftime("%Y%m%dT%H%M%SZ")
    end_utc_str = utc_end.strftime("%Y%m%dT%H%M%SZ")

    title = f"{service.name} with {freelancer.business_name or 'your freelancer'}"
    description = f"Service: {service.name}\\nBooked via SlotMe"
    location = freelancer.business_address or "Online"

    # 🔥 Include frozen timezone in ICS file
    from zoneinfo import ZoneInfo

    frozen_tz = ZoneInfo(appt.freelancer_timezone or "America/New_York")
    local_start = utc_start.astimezone(frozen_tz)
    timezone_abbr = local_start.tzname()

    # ✅ Include timezone info for better calendar compatibility (no leading whitespace)
    ics = f"""BEGIN:VCALENDAR
    VERSION:2.0
    PRODID:-//SlotMe//Booking System//EN
    METHOD:PUBLISH
    BEGIN:VEVENT
    UID:{appt.id}@slotme.xyz
    DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}
    DTSTART:{start_utc_str}
    DTEND:{end_utc_str}
    SUMMARY:{title}
    DESCRIPTION:{description}\\nTimezone: {timezone_abbr}
    LOCATION:{location}
    STATUS:CONFIRMED
    END:VEVENT
    END:VCALENDAR""".replace(
        "    ", ""
    )  # Strip leading spaces

    return Response(
        ics,
        mimetype="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=slotme-booking.ics"},
    )


@booking_bp.route("/appointments", methods=["GET", "OPTIONS"])
@cross_origin(
    origins=ALLOWED_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
)
@require_auth
def get_appointments():
    f = g.freelancer

    appointments = Appointment.query.filter_by(freelancer_id=f.id).all()
    result = []

    for a in appointments:
        # 🔥 SKIP orphaned appointments (slot was deleted)
        if not a.slot:
            print(f"⚠️ Skipping orphaned appointment {a.id} - slot was deleted")
            continue

        user = a.user
        # ✅ Convert UTC slot time to appointment's frozen timezone
        try:
            # 🔥 Use the frozen timezone from when appointment was created
            frozen_tz = ZoneInfo(a.freelancer_timezone or "America/New_York")
            # Parse the UTC time stored in the DB
            slot_date = datetime.strptime(a.slot.day, "%Y-%m-%d").date()
            utc_time = dt_time.fromisoformat(a.slot.master_time.time_24h)

            utc_dt = datetime.combine(slot_date, utc_time).replace(
                tzinfo=ZoneInfo("UTC")
            )
            local_dt = utc_dt.astimezone(frozen_tz)

            local_time_display = local_dt.strftime("%I:%M %p").lstrip("0")
            timezone_abbr = local_dt.tzname()

            # 🔥 FIX: Use the LOCAL DATE, not the UTC date
            local_date_str = local_dt.strftime("%Y-%m-%d")
        except Exception as e:
            print(f"❌ Error converting time for appointment {a.id}: {e}")
            local_time_display = a.slot.master_time.label
            timezone_abbr = "UTC"
            local_date_str = a.slot.day  # fallback to UTC date

        result.append(
            {
                "id": a.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "name": f"{user.first_name} {user.last_name}",
                "email": user.email,
                "phone": user.phone,
                "slot_day": local_date_str,  # 🔥 FIXED: Use local date
                "slot_time": local_time_display,
                "freelancer_timezone": (
                    a.freelancer.timezone if a.freelancer else "America/New_York"
                ),
                "timezone_abbr": timezone_abbr,
                "status": a.status,
                "service": a.service.name if a.service else None,
                "service_duration_minutes": (
                    a.service.duration_minutes if a.service else None
                ),
                "custom_responses": a.custom_responses or {},
            }
        )

    return jsonify(result)


@booking_bp.route("/appointments/<int:id>", methods=["PATCH", "OPTIONS"])
@cross_origin(
    origins=ALLOWED_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
)
@require_auth
def update_appointment(id):
    f = g.freelancer
    freelancer_id = f.id

    data = request.get_json() or {}
    print(f"🔧 Updating appointment {id}...")

    appointment = Appointment.query.get(id)
    if not appointment:
        print("❌ Appointment not found.")
        return jsonify({"error": "Appointment not found"}), 404

    # ownership
    if appointment.freelancer_id != freelancer_id:
        print(
            f"🚫 Forbidden. Caller {freelancer_id} != appointment.freelancer_id {appointment.freelancer_id}"
        )
        return jsonify({"error": "forbidden"}), 403

    # --- status change ---
    if "status" in data:
        new_status = data["status"]
        # Only allow reverting to pending or cancelling via CRM
        if new_status not in ["pending", "cancelled"]:
            return jsonify({"error": "Invalid status value"}), 400

        if new_status == "confirmed":
            return (
                jsonify({"error": "Appointments can only be confirmed by email link."}),
                403,
            )

        appointment.status = new_status

        if new_status == "cancelled":
            # free the root slot + inherited blocks
            appointment.slot.is_booked = False
            clear_inherited_blocks(
                freelancer_id=freelancer_id,
                day=appointment.slot.day,
                start_label=appointment.slot.master_time.label,
                duration_minutes=appointment.service.duration_minutes,
            )

            # 🔥 NEW: Notify customer when freelancer cancels
            try:
                from services.email_service import (
                    send_customer_cancellation_confirmation,
                )

                send_customer_cancellation_confirmation(
                    appointment, cancelled_by="freelancer"
                )
            except Exception as e:
                print(f"⚠️ Failed to send customer cancellation notification: {e}")

    # --- slot change ---
    if "slot_id" in data:
        new_slot = TimeSlot.query.get(data["slot_id"])
        if not new_slot or new_slot.freelancer_id != freelancer_id:
            return jsonify({"error": "Invalid new slot"}), 404
        if new_slot.is_booked:
            return jsonify({"error": "Time slot is already booked"}), 400

        # free the old root slot + inherited blocks
        old_slot = appointment.slot
        old_slot.is_booked = False
        clear_inherited_blocks(
            freelancer_id=freelancer_id,
            day=old_slot.day,
            start_label=old_slot.master_time.label,
            duration_minutes=appointment.service.duration_minutes,
        )

        # move the appointment to the new root slot
        appointment.slot_id = new_slot.id
        new_slot.is_booked = True
        # (optional: also mark inherited blocks for the new slot if your UI expects that)

    db.session.commit()
    print(f"✅ Appointment {id} updated. New status: {appointment.status}")
    return jsonify({"message": "Appointment updated successfully."}), 200


@booking_bp.route("/slots", methods=["POST"])
@jwt_required()
def create_time_slot():
    freelancer_id = int(get_jwt_identity())
    data = request.get_json()

    day = data.get("day")
    master_time_id = data.get("master_time_id")

    if not day or not master_time_id:
        return jsonify({"error": "Missing day or master_time_id"}), 400

    master_time = MasterTimeSlot.query.get(master_time_id)
    if not master_time:
        return jsonify({"error": "Invalid master time ID"}), 400

    # Check if slot already exists (ignore timezone for duplicate check)
    existing = TimeSlot.query.filter_by(
        freelancer_id=freelancer_id,
        day=day,
        master_time_id=master_time_id,
    ).first()

    if existing:
        return (
            jsonify(
                {
                    "error": "Time slot already exists",
                    "slot_id": existing.id,
                    "is_booked": existing.is_booked,
                }
            ),
            400,
        )

    # Check if this time conflicts with existing appointments
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    target_label = master_time.label
    time_labels = [t.label for t in all_times]

    is_booked = False
    is_inherited_block = False

    # Check all confirmed appointments for this freelancer on this day
    appointments = (
        Appointment.query.join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .join(MasterTimeSlot, TimeSlot.master_time_id == MasterTimeSlot.id)
        .filter(TimeSlot.day == day)
        .filter(Appointment.freelancer_id == freelancer_id)
        .filter(Appointment.status == "confirmed")  # Only check confirmed appointments
        .all()
    )

    for appt in appointments:
        appt_start_label = appt.slot.master_time.label
        duration_blocks = appt.service.duration_minutes // 15

        try:
            appt_index = time_labels.index(appt_start_label)
            appt_labels = time_labels[appt_index : appt_index + duration_blocks]

            if target_label in appt_labels:
                is_booked = True
                is_inherited_block = target_label != appt_labels[0]
                break
        except ValueError:
            continue

    # Create the slot
    freelancer = Freelancer.query.get(freelancer_id)
    slot = TimeSlot(
        day=day,
        master_time_id=master_time_id,
        freelancer_id=freelancer_id,
        is_booked=is_booked,
        is_inherited_block=is_inherited_block,
        timezone=(
            freelancer.timezone if freelancer else "America/New_York"
        ),  # 🔥 FREEZE timezone
    )

    try:
        db.session.add(slot)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create slot"}), 500

    return (
        jsonify(
            {"message": "Time slot created", "slot_id": slot.id, "is_booked": is_booked}
        ),
        201,
    )


@booking_bp.route("/slots/<int:slot_id>", methods=["DELETE"])
@jwt_required()
def delete_time_slot(slot_id):
    freelancer_id = int(get_jwt_identity())
    slot = TimeSlot.query.get(slot_id)

    print(f"🧪 Attempting to delete slot_id: {slot_id}")
    print(f"🔑 Authenticated freelancer_id: {freelancer_id}")
    if slot:
        print(f"📦 Slot found, owned by freelancer_id: {slot.freelancer_id}")
    else:
        print("❌ Slot not found in DB")

    if not slot or slot.freelancer_id != freelancer_id:
        return jsonify({"error": "Slot not found or unauthorized"}), 404

    if slot.is_booked:
        print("🚫 Cannot delete — slot is booked.")
        return jsonify({"error": "Cannot delete a booked slot"}), 400

    # 🧼 Check if a CANCELLED appointment is still linked to this slot
    linked_appt = Appointment.query.filter_by(slot_id=slot.id).first()
    if linked_appt:
        if linked_appt.status != "cancelled":
            print(
                f"🚫 Cannot delete — appointment {linked_appt.id} is still active ({linked_appt.status})"
            )
            return jsonify({"error": "Slot has an active appointment"}), 400
        else:
            print(
                f"🧹 Removing cancelled appointment {linked_appt.id} before deleting slot..."
            )
            db.session.delete(linked_appt)  # hard delete the zombie appointment

    try:
        db.session.delete(slot)
        db.session.commit()
        print("✅ Slot deleted successfully.")
        return jsonify({"message": "Slot deleted"}), 200
    except Exception as e:
        print("❌ Unexpected delete failure:", e)
        return jsonify({"error": "Internal server error"}), 500


@booking_bp.route("/master-times", methods=["GET"])
def get_master_time_slots():
    from models import MasterTimeSlot

    times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    result = [{"id": t.id, "label": t.label, "time_24h": t.time_24h} for t in times]
    return jsonify(result)


@booking_bp.route("/resend-confirmation/<int:appointment_id>", methods=["POST"])
def resend_confirmation_email(appointment_id):
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({"error": "Appointment not found"}), 404

    if appointment.status == "confirmed":
        return jsonify({"error": "This appointment is already confirmed."}), 400

    if appointment.status == "cancelled":
        return (
            jsonify(
                {
                    "error": "This appointment was already cancelled. Please refresh and book again."
                }
            ),
            400,
        )

    user = appointment.user
    token = serializer.dumps({"appointment_id": appointment.id}, salt="booking-confirm")
    link = f"{BACKEND_ORIGIN}/confirm-booking/{token}"

    from zoneinfo import ZoneInfo

    slot = appointment.slot
    service = appointment.service
    freelancer = appointment.freelancer

    # Convert UTC slot to freelancer-local time
    slot_tz = ZoneInfo(slot.timezone or freelancer.timezone or "America/New_York")
    slot_date = datetime.strptime(slot.day, "%Y-%m-%d").date()
    utc_time = datetime.strptime(slot.master_time.time_24h, "%H:%M").time()
    utc_dt = datetime.combine(slot_date, utc_time).replace(tzinfo=ZoneInfo("UTC"))
    local_dt = utc_dt.astimezone(slot_tz)
    local_time_display = local_dt.strftime("%I:%M %p").lstrip("0")
    timezone_abbr = local_dt.tzname()
    local_date_display = local_dt.strftime("%A, %B %d, %Y")

    subject = f"🔁 Resend: Confirm Your Appointment – {freelancer.business_name or freelancer.first_name}"
    # Format price for resend email
    price_display = f"${service.price_usd:.2f}" if service.price_usd else "Free"

    body = f"""Hi {user.first_name},
Oops! Looks like our first email might've gone missing — no worries! Here's your confirmation link again so you don't miss your appointment.

⏰ IMPORTANT: This confirmation link expires in 15 minutes!
Please confirm now to secure your appointment.

📋 Service: {service.name}
💰 Price: {price_display}
⏱️ Duration: {service.duration_minutes} minutes
🗓️ Date: {local_date_display}
⏰ Time: {local_time_display} {timezone_abbr}
👤 With: {freelancer.first_name} {freelancer.last_name}
🏢 Business: {freelancer.business_name or "N/A"}

✅ Confirm your booking here:
{link}

Once confirmed, you'll receive a final confirmation email with all your details.
If you've already confirmed, you can safely ignore this message.

— The SlotMe Team
https://slotme.xyz
"""

    try:
        send_branded_customer_reply(subject, body, user.email)
    except Exception as e:
        print("❌ Failed to resend confirmation email:", e)
        return jsonify({"error": "Failed to send email"}), 500

    return jsonify({"success": True}), 200


@booking_bp.route("/public-appointment/<int:appointment_id>")
@cross_origin(origins=ALLOWED_ORIGINS)
def get_public_appointment(appointment_id):

    appt = Appointment.query.get(appointment_id)
    if not appt or appt.status == "cancelled":
        return jsonify({"error": "Not found"}), 404

    # ✅ Convert UTC time to slot's frozen timezone
    # 🔥 Use appointment.freelancer_timezone (frozen at booking time)
    frozen_tz = ZoneInfo(appt.freelancer_timezone or "America/New_York")

    slot_date = datetime.strptime(appt.slot.day, "%Y-%m-%d").date()
    utc_time = dt_time.fromisoformat(appt.slot.master_time.time_24h)
    utc_dt = datetime.combine(slot_date, utc_time).replace(tzinfo=ZoneInfo("UTC"))

    # Convert to the frozen timezone
    local_dt = utc_dt.astimezone(frozen_tz)
    local_time_display = local_dt.strftime("%I:%M %p").lstrip("0")
    timezone_abbr = local_dt.tzname()

    # Calendar URLs use UTC with 'Z' suffix
    start_str = utc_dt.strftime("%Y%m%dT%H%M%SZ")
    end_dt = utc_dt + timedelta(minutes=appt.service.duration_minutes)
    end_str = end_dt.strftime("%Y%m%dT%H%M%SZ")

    calendar_url = (
        "https://calendar.google.com/calendar/render?action=TEMPLATE"
        f"&text={appt.service.name} with {appt.freelancer.business_name or 'your freelancer'}"
        f"&dates={start_str}/{end_str}"
        f"&details=Booked via SlotMe"
        f"&location={appt.freelancer.business_address or 'Online'}"
    )

    return jsonify(
        {
            "first_name": appt.user.first_name,
            "freelancer_name": appt.freelancer.business_name
            or f"{appt.freelancer.first_name} {appt.freelancer.last_name}",
            "day": appt.slot.day,
            "time": local_time_display,  # ✅ LOCAL TIME
            "timezone": timezone_abbr,  # ✅ EDT/PST/etc
            "service_name": appt.service.name,
            "business_address": appt.freelancer.business_address or None,
            "calendar_url": calendar_url,
        }
    )


@booking_bp.route("/cancel-booking/<cancel_token>", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS)
def cancel_booking_redirect(cancel_token):
    """Email link - redirects user to frontend confirmation page"""
    print("🔐 Cancel GET route hit with token:", cancel_token)
    return redirect(f"{FRONTEND_URL}/cancel/{cancel_token}")


@booking_bp.route("/cancel-booking/<cancel_token>", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS)
def cancel_booking_execute(cancel_token):
    """API endpoint - actually performs the cancellation after user confirms"""
    print("🔐 Cancel POST route hit with token:", cancel_token)

    appointment = Appointment.query.filter_by(cancel_token=cancel_token).first()
    if not appointment:
        print("❌ Invalid cancel token")
        return jsonify({"error": "Invalid or expired cancellation link"}), 404

    if appointment.status != "confirmed":
        print(f"🚫 Not cancellable. Current status: {appointment.status}")
        return (
            jsonify(
                {
                    "error": "This appointment has already been cancelled or is not confirmed"
                }
            ),
            400,
        )

    # Perform cancellation
    appointment.status = "cancelled"
    appointment.slot.is_booked = False

    # Clear inherited blocks
    clear_inherited_blocks(
        freelancer_id=appointment.freelancer_id,
        day=appointment.slot.day,
        start_label=appointment.slot.master_time.label,
        duration_minutes=appointment.service.duration_minutes,
    )

    db.session.commit()

    # 🔥 NEW: Send cancellation emails
    try:
        from services.email_service import send_freelancer_cancellation_notification

        send_freelancer_cancellation_notification(appointment)
    except Exception as e:
        print(f"⚠️ Failed to send freelancer cancellation notification: {e}")

    try:
        from services.email_service import send_customer_cancellation_confirmation

        send_customer_cancellation_confirmation(appointment, cancelled_by="customer")
    except Exception as e:
        print(f"⚠️ Failed to send customer cancellation confirmation: {e}")

    print("✅ Appointment cancelled successfully.")
    return (
        jsonify({"success": True, "message": "Appointment cancelled successfully"}),
        200,
    )


@booking_bp.route("/check-booking-status/<identifier>", methods=["GET", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def check_booking_status(identifier):
    # 🔥 NEW: Priority lookup order (ID → custom_url → public_slug)
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

    email = request.args.get("email")
    if not email:
        return jsonify({"error": "Missing email"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"status": "none"})

    active = (
        Appointment.query.filter_by(freelancer_id=freelancer_id, user_id=user.id)
        .filter(Appointment.status.in_(["pending", "confirmed"]))
        .first()
    )

    if not active:
        return jsonify({"status": "none"})

    return jsonify({"status": active.status})


@booking_bp.route("/appointments/export-csv", methods=["GET"])
@require_auth
@require_tier("csv_export")
def export_appointments_csv():
    f = g.freelancer
    appointments = Appointment.query.filter_by(freelancer_id=f.id).all()

    import csv
    import json
    from io import StringIO
    from datetime import datetime
    from zoneinfo import ZoneInfo

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(
        [
            "Appointment ID",
            "First Name",
            "Last Name",
            "Email",
            "Phone",
            "Service Date",
            "Service Time",
            "Timezone",
            "Status",
            "Service",
            "Duration (min)",
            "Custom Responses",
            "Booked On",
        ]
    )

    for a in appointments:
        user = a.user
        slot = a.slot

        # 🔥 Convert UTC to slot's local timezone
        slot_timezone = slot.timezone or f.timezone or "America/New_York"

        # Parse UTC datetime from database
        utc_datetime_str = f"{slot.day} {slot.master_time.time_24h}"
        utc_datetime = datetime.strptime(utc_datetime_str, "%Y-%m-%d %H:%M").replace(
            tzinfo=ZoneInfo("UTC")
        )

        # Convert to slot's local timezone
        local_datetime = utc_datetime.astimezone(ZoneInfo(slot_timezone))
        local_date = local_datetime.strftime("%Y-%m-%d")  # 2025-11-29
        local_time = local_datetime.strftime("%I:%M %p")  # 06:00 PM

        # Get timezone abbreviation (EST, PST, etc.)
        timezone_abbr = local_datetime.strftime("%Z")

        # 🔥 Format custom responses as readable text
        custom_responses_str = ""
        if a.custom_responses:
            try:
                responses = (
                    json.loads(a.custom_responses)
                    if isinstance(a.custom_responses, str)
                    else a.custom_responses
                )
                custom_responses_str = "; ".join(
                    [f"{q}: {ans}" for q, ans in responses.items()]
                )
            except:
                custom_responses_str = str(a.custom_responses)

        # 🔥 Booking created date
        booked_on = a.timestamp.strftime("%Y-%m-%d %H:%M:%S") if a.timestamp else ""

        writer.writerow(
            [
                a.id,
                user.first_name,
                user.last_name,
                user.email,
                user.phone or "",
                local_date,  # 🔥 LOCAL date (Nov 29, not Nov 30)
                local_time,  # 🔥 LOCAL time (6:00 PM, not 2:00 AM)
                timezone_abbr,  # 🔥 PST/EST/etc
                a.status,
                a.service.name if a.service else "",
                a.service.duration_minutes if a.service else "",
                custom_responses_str,  # 🔥 Custom Q&A
                booked_on,  # 🔥 When they booked
            ]
        )

    output.seek(0)
    return Response(
        output.read(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=appointments.csv"},
    )


@booking_bp.route("/appointment/<int:appointment_id>", methods=["GET"])
@require_auth
def get_appointment_by_id(appointment_id):
    appointment = Appointment.query.get(appointment_id)

    if not appointment:
        return jsonify({"error": "Appointment not found"}), 404

    if appointment.slot.freelancer_id != g.freelancer.id:
        return jsonify({"error": "unauthorized"}), 403

    return jsonify(
        {
            "id": appointment.id,
            "first_name": appointment.user.first_name,
            "last_name": appointment.user.last_name,
            "email": appointment.email,
            "status": appointment.status,
            "timestamp": appointment.timestamp.isoformat(),
            "service": {
                "name": appointment.service.name,
                "duration": appointment.service.duration_minutes,
            },
            "slot": {
                "day": appointment.slot.day,
                "time": appointment.slot.master_time.label,
            },
            "custom_responses": appointment.custom_responses,
        }
    )


@booking_bp.route("/appointments/internal", methods=["POST", "OPTIONS"])
@cross_origin(
    origins=ALLOWED_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
)
@require_auth
def create_internal_appointment():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    freelancer_id = g.freelancer.id
    data = request.get_json()

    # Required fields
    # Store raw text - React escapes in UI, plain text emails are XSS-safe
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    slot_id = data.get("slot_id")
    service_id = data.get("service_id")

    if not all([first_name, last_name, email, phone, slot_id, service_id]):
        return jsonify({"error": "Missing required fields"}), 400

    # Verify slot exists and belongs to this freelancer
    slot = TimeSlot.query.get(slot_id)
    if not slot or slot.freelancer_id != freelancer_id:
        return jsonify({"error": "Invalid slot"}), 400

    if slot.is_booked:
        return jsonify({"error": "Slot is already booked"}), 400

    # Verify service exists and belongs to this freelancer
    service = Service.query.get(service_id)
    if not service or service.freelancer_id != freelancer_id:
        return jsonify({"error": "Invalid service"}), 400

    # ✅ CHECK FOR CONFLICTS across all required time blocks
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]

    duration_blocks = service.duration_minutes // 15
    start_label = slot.master_time.label

    try:
        start_index = time_labels.index(start_label)
    except ValueError:
        return jsonify({"error": "Invalid slot time"}), 400

    required_labels = time_labels[start_index : start_index + duration_blocks]

    # Check if any required slots are already booked
    confirmed_conflict = (
        Appointment.query.join(TimeSlot)
        .join(MasterTimeSlot)
        .filter(
            Appointment.freelancer_id == freelancer_id,
            Appointment.status == "confirmed",
            TimeSlot.day == slot.day,
            MasterTimeSlot.label.in_(required_labels),
        )
        .first()
    )

    if confirmed_conflict:
        return (
            jsonify(
                {
                    "error": "Not enough consecutive free time for this service. Choose a different time or shorter service."
                }
            ),
            400,
        )

    # Create or update user
    user = User.query.filter_by(email=email).first()
    if user:
        user.first_name = first_name
        user.last_name = last_name
        user.phone = phone
    else:
        user = User(
            first_name=first_name, last_name=last_name, email=email, phone=phone
        )
        db.session.add(user)

    db.session.commit()

    # Check for duplicate booking for exact same slot
    duplicate_slot = Appointment.query.filter(
        Appointment.user_id == user.id,
        Appointment.freelancer_id == freelancer_id,
        Appointment.slot_id == slot_id,
        Appointment.status.in_(["pending", "confirmed"]),
    ).first()

    if duplicate_slot:
        return (
            jsonify({"error": "Customer already has a booking for this time slot"}),
            400,
        )

    # Prevent abuse: max 3 bookings per email per day
    same_day_bookings = (
        Appointment.query.filter(
            Appointment.user_id == user.id,
            Appointment.freelancer_id == freelancer_id,
            Appointment.status.in_(["pending", "confirmed"]),
        )
        .join(TimeSlot)
        .filter(TimeSlot.day == slot.day)
        .count()
    )

    if same_day_bookings >= 3:
        return (
            jsonify(
                {"error": "Customer already has 3 bookings today. Maximum 3 per day."}
            ),
            400,
        )

    # Create appointment - DIRECTLY as confirmed (bypassing email confirmation)
    freelancer_timezone = (
        slot.timezone or data.get("freelancer_timezone") or g.freelancer.timezone
    )

    appointment = Appointment(
        slot_id=slot_id,
        freelancer_id=freelancer_id,
        user_id=user.id,
        service_id=service_id,
        status="confirmed",
        email=email,
        phone=phone,
        freelancer_timezone=freelancer_timezone,  # 🔥 Use slot's frozen timezone
        timestamp=datetime.now(timezone.utc),
    )
    db.session.add(appointment)

    # Mark the slot as booked
    slot.is_booked = True

    # Mark inherited blocks as booked
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]
    duration_blocks = service.duration_minutes // 15
    start_label = slot.master_time.label

    try:
        start_index = time_labels.index(start_label)
        required_labels = time_labels[start_index : start_index + duration_blocks]

        for i, label in enumerate(required_labels):
            mt = next((m for m in all_times if m.label == label), None)
            if not mt:
                continue

            s = TimeSlot.query.filter_by(
                day=slot.day, freelancer_id=freelancer_id, master_time_id=mt.id
            ).first()

            if s:
                s.is_booked = True
                s.is_inherited_block = i != 0  # First slot is root, rest are inherited

    except ValueError:
        pass

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Internal appointment created successfully",
                "appointment_id": appointment.id,
            }
        ),
        201,
    )


# Add this route for debugging
@booking_bp.route("/debug/check-duplicates/<int:freelancer_id>", methods=["GET"])
@require_auth
def check_duplicates(freelancer_id):
    if g.freelancer.id != freelancer_id:
        return jsonify({"error": "Unauthorized"}), 403

    duplicates = (
        db.session.query(
            TimeSlot.freelancer_id,
            TimeSlot.day,
            TimeSlot.master_time_id,
            db.func.count(TimeSlot.id).label("count"),
        )
        .filter_by(freelancer_id=freelancer_id)
        .group_by(TimeSlot.freelancer_id, TimeSlot.day, TimeSlot.master_time_id)
        .having(db.func.count(TimeSlot.id) > 1)
        .all()
    )

    return jsonify(
        {
            "freelancer_id": freelancer_id,
            "duplicate_slots": len(duplicates),
            "details": [
                {"day": d.day, "master_time_id": d.master_time_id, "count": d.count}
                for d in duplicates
            ],
        }
    )


@booking_bp.route("/preview-cancel/<cancel_token>", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def preview_cancel(cancel_token):
    appointment = Appointment.query.filter_by(cancel_token=cancel_token).first()
    if not appointment:
        return jsonify({"error": "Invalid token"}), 404
    if appointment.status != "confirmed":
        return jsonify({"error": "Not cancellable"}), 400

    # 🔥 FIX: Treat slot.day as LOCAL date, not UTC date
    from zoneinfo import ZoneInfo
    from datetime import datetime, time as dt_time

    # 🔥 Use frozen timezone from appointment
    frozen_tz = ZoneInfo(appointment.freelancer_timezone or "America/New_York")

    # ✅ Step 1: Rebuild the slot datetime in UTC
    slot_day = appointment.slot.day  # '2025-10-15'
    slot_time = appointment.slot.master_time.time_24h  # '03:00'
    utc_dt = datetime.strptime(f"{slot_day} {slot_time}", "%Y-%m-%d %H:%M").replace(
        tzinfo=timezone.utc
    )

    # ✅ Step 2: Convert to frozen timezone
    local_dt = utc_dt.astimezone(frozen_tz)

    # Convert to UTC to verify
    utc_dt = local_dt.astimezone(ZoneInfo("UTC"))

    # Convert back to frozen timezone for display
    display_local_dt = utc_dt.astimezone(frozen_tz)

    local_time_display = display_local_dt.strftime("%I:%M %p").lstrip("0")
    timezone_abbr = display_local_dt.tzname()
    return (
        jsonify(
            {
                "id": appointment.id,
                "freelancer_name": appointment.freelancer.business_name
                or "your freelancer",
                "service_name": appointment.service.name if appointment.service else "",
                "slot_day": appointment.slot.day,  # ✅ Use raw UTC date from DB
                "slot_time": local_time_display,
                "timezone_abbr": timezone_abbr,
                "status": appointment.status,
            }
        ),
        200,
    )


@booking_bp.route("/debug-cancel-token/<token>", methods=["GET"])
@cross_origin(origins=ALLOWED_ORIGINS)
def debug_cancel_token(token):
    try:
        data = serializer.loads(token, salt="cancel-booking", max_age=86400)
        appointment_id = data.get("appointment_id")

        appt = Appointment.query.get(appointment_id)
        if not appt:
            return jsonify({"error": "Appointment not found"}), 404

        return (
            jsonify(
                {
                    "id": appt.id,
                    "status": appt.status,
                    "email": appt.email,
                    "freelancer_id": appt.freelancer_id,
                    "user_id": appt.user_id,
                    "service_id": appt.service_id,
                    "slot_id": appt.slot_id,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 400
