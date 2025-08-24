# backend/routes/booking_routes.py

import os
from flask import Blueprint, request, jsonify, Response, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
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
from config import FRONTEND_ORIGIN
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
    FRONTEND_ORIGIN,
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
from flask_cors import cross_origin
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

    # 🛡️ Honeypot Silent Bot Trap (Dynamic Field + Extra Key Detection)
    HUMAN_FIELDS = {
        "first_name",
        "last_name",
        "email",
        "phone",
        "slot_id",
        "service_id",
    }

    # Separate unexpected keys
    unexpected = [key for key in data.keys() if key not in HUMAN_FIELDS]

    # Classic fixed trap for legacy bots
    if data.get("website"):
        return jsonify({"error": "Spam detected"}), 400

    # Dynamic trap — ANY extra field with value = bot
    for key in unexpected:
        if data.get(key):
            return jsonify({"error": "Spam detected"}), 400

    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    phone = data.get("phone")
    slot_id = data.get("slot_id")
    service_id = data.get("service_id")

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

    # 🛡️ Prevent multiple pending bookings for same freelancer
    # 🛡️ Prevent abuse: only 1 active booking per email per freelancer
    existing_active = Appointment.query.filter(
        Appointment.user_id == user.id,
        Appointment.freelancer_id == slot.freelancer_id,
        Appointment.status.in_(["pending", "confirmed"]),
    ).first()

    if existing_active:
        return (
            jsonify(
                {
                    "error": "You already have a booking with this freelancer. Cancel or reschedule before making another.",
                    "appointment_id": existing_active.id,
                    "status": existing_active.status,
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

    appointment = Appointment(
        slot_id=slot_id,
        freelancer_id=slot.freelancer_id,
        user_id=user.id,
        service_id=service_id,
        status="pending",
        email=email,  # <- NEW
        phone=phone,
        timestamp=datetime.now(timezone.utc),
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

    subject = "Confirm Your Appointment – SlotMe"
    body = f"""Hi {first_name},

    Thanks for booking with SlotMe! You're one step away from confirming your appointment.

    ✅ Confirm here: {link}

    If you didn’t request this, feel free to ignore it.

    – The SlotMe Team
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
        data = serializer.loads(token, salt="booking-confirm", max_age=600)
        appointment_id = data["appointment_id"]
    except SignatureExpired:
        return redirect(f"{FRONTEND_ORIGIN}/expired")
    except BadSignature:
        return redirect(f"{FRONTEND_ORIGIN}/invalid")

    appointment = Appointment.query.get(appointment_id)

    if appointment and appointment.status == "pending":
        slot = appointment.slot

        # Load all master times and compute required labels FIRST
        all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
        time_labels = [t.label for t in all_times]

        duration_blocks = appointment.service.duration_minutes // 15
        start_label = slot.master_time.label

        try:
            start_index = time_labels.index(start_label)
        except ValueError:
            return redirect(f"{FRONTEND_ORIGIN}/invalid")

        required_labels = time_labels[start_index : start_index + duration_blocks]

        if len(required_labels) < duration_blocks:
            remaining_labels = time_labels[start_index:]
            if len(remaining_labels) < 1:
                return redirect(f"{FRONTEND_ORIGIN}/invalid")
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
                    f"{FRONTEND_ORIGIN}/already-taken?freelancer_id={slot.freelancer_id}"
                )

        # No conflicts, safe to confirm
        appointment.status = "confirmed"
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

        subject = "📅 Your Appointment is Confirmed – SlotMe"
        body = f"""Hi {user.first_name},

Thanks for confirming your booking!

✅ Appointment Details:
• Freelancer: {freelancer.business_name or "your freelancer"}
• Service: {service.name}
• Date: {formatted_date}
• Time: {formatted_time} (UTC)
"""

        if freelancer.business_address:
            body += f"• Location: {freelancer.business_address}\n"
        body += f"\n📅 Add to your calendar: {calendar_url}\n"
        body += "\nIf you need to cancel or reschedule, please contact the freelancer directly.\n– The SlotMe Team"

        try:
            send_branded_customer_reply(subject, body, user.email)
        except Exception as e:
            print("❌ Failed to send booking receipt:", e)

        return redirect(
            f"{FRONTEND_ORIGIN}/booking-confirmed?appointment_id={appointment.id}"
        )

    return redirect(f"{FRONTEND_ORIGIN}/not-found")


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

    # Parse naive time assuming it's in Eastern Time (local UI-facing label)
    naive_start = datetime.strptime(
        f"{slot.day} {slot.master_time.time_24h}", "%Y-%m-%d %H:%M"
    )
    utc_start = naive_start.replace(tzinfo=timezone.utc)
    utc_end = utc_start + timedelta(minutes=service.duration_minutes)

    # Format for ICS (UTC Zulu time format)
    start_utc_str = utc_start.strftime("%Y%m%dT%H%M%SZ")
    end_utc_str = utc_end.strftime("%Y%m%dT%H%M%SZ")

    title = f"{service.name} with {freelancer.business_name or 'your freelancer'}"
    description = "Booked via SlotMe"
    location = freelancer.business_address or "Online"

    ics = f"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:{title}
DTSTART:{start_utc_str}
DTEND:{end_utc_str}
LOCATION:{location}
DESCRIPTION:{description}
END:VEVENT
END:VCALENDAR"""

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
        user = a.user
        result.append(
            {
                "id": a.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "name": f"{user.first_name} {user.last_name}",
                "email": user.email,
                "phone": user.phone,
                "slot_day": a.slot.day,
                "slot_time": a.slot.master_time.label,
                "status": a.status,
                "freelancer_timezone": "UTC",
                "service": a.service.name if a.service else None,  # ✅ add this
                "service_duration_minutes": (
                    a.service.duration_minutes if a.service else None
                ),  # ✅ and this
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

    # Check if slot already exists (FIXED: prevent duplicates)
    existing = TimeSlot.query.filter_by(
        freelancer_id=freelancer_id, day=day, master_time_id=master_time_id
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
    slot = TimeSlot(
        day=day,
        master_time_id=master_time_id,
        freelancer_id=freelancer_id,
        is_booked=is_booked,
        is_inherited_block=is_inherited_block,
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

    subject = "Confirm Your Appointment – SlotMe (Resend)"
    body = f"""Hi {user.first_name},

You requested a new confirmation email for your appointment.

Just click the link below to confirm:

{link}

If you didn’t request this, feel free to ignore it.

– The SlotMe Team
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

    start_dt = datetime.strptime(
        f"{appt.slot.day} {appt.slot.master_time.time_24h}", "%Y-%m-%d %H:%M"
    )
    end_dt = start_dt + timedelta(minutes=appt.service.duration_minutes)
    start_str = start_dt.strftime("%Y%m%dT%H%M%S")
    end_str = end_dt.strftime("%Y%m%dT%H%M%S")

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
            # Removed last name for privacy
            "freelancer_name": appt.freelancer.business_name or "your freelancer",
            "day": appt.slot.day,
            "time": appt.slot.master_time.label,
            "timezone": "UTC",
            "service_name": appt.service.name,
            "business_address": appt.freelancer.business_address or None,
            "calendar_url": calendar_url,
        }
    )


@booking_bp.route("/cancel-booking/<token>", methods=["GET"])
def cancel_booking(token):
    try:
        data = serializer.loads(
            token, salt="booking-confirm", max_age=600
        )  # 600 seconds = 10 min
        appointment_id = data["appointment_id"]
    except SignatureExpired:
        return redirect(f"{FRONTEND_ORIGIN}/expired")
    except BadSignature:
        return redirect(f"{FRONTEND_ORIGIN}/invalid")

    appointment = Appointment.query.get(appointment_id)
    if not appointment or appointment.status != "pending":
        return redirect(f"{FRONTEND_ORIGIN}/not-found")

    appointment.status = "cancelled"
    appointment.slot.is_booked = False

    clear_inherited_blocks(
        freelancer_id=appointment.freelancer_id,
        day=appointment.slot.day,
        start_label=appointment.slot.master_time.label,
        duration_minutes=appointment.service.duration_minutes,
    )

    db.session.commit()
    return redirect(
        f"{FRONTEND_ORIGIN}/booking-page/{appointment.freelancer_id}?cancelled=true"
    )


@booking_bp.route("/check-booking-status/<identifier>", methods=["GET", "OPTIONS"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def check_booking_status(identifier):
    if identifier.isdigit():
        freelancer_id = int(identifier)
    else:
        freelancer = Freelancer.query.filter_by(custom_url=identifier.lower()).first()
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
    from io import StringIO

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Appointment ID",
            "First Name",
            "Last Name",
            "Email",
            "Phone",
            "Date",
            "Time",
            "Status",
            "Service",
            "Duration (min)",
        ]
    )

    for a in appointments:
        user = a.user
        writer.writerow(
            [
                a.id,
                user.first_name,
                user.last_name,
                user.email,
                user.phone,
                a.slot.day,
                a.slot.master_time.label,
                a.status,
                a.service.name if a.service else "",
                a.service.duration_minutes if a.service else "",
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
        }
    )


@booking_bp.route("/appointments/internal", methods=["POST"])
@require_auth
def create_internal_appointment():
    freelancer_id = g.freelancer.id
    data = request.get_json()

    # Required fields
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    phone = data.get("phone")
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

    # Check for existing active appointments (same logic as external booking)
    existing_active = Appointment.query.filter(
        Appointment.user_id == user.id,
        Appointment.freelancer_id == freelancer_id,
        Appointment.status.in_(["pending", "confirmed"]),
    ).first()

    if existing_active:
        return (
            jsonify({"error": "Customer already has an active booking with you"}),
            400,
        )

    # Create appointment - DIRECTLY as confirmed (bypassing email confirmation)
    appointment = Appointment(
        slot_id=slot_id,
        freelancer_id=freelancer_id,
        user_id=user.id,
        service_id=service_id,
        status="confirmed",  # Direct confirmation for internal bookings
        email=email,
        phone=phone,
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
