# This file is pretty much like a .app file in Express that holds all of our routes

from flask import Flask, request, jsonify, redirect, Response
from flask import g
from flask_cors import CORS, cross_origin
from models import db, TimeSlot, Appointment, Freelancer, User, MasterTimeSlot, Service
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re  # Regular Expression
from werkzeug.security import check_password_hash  # At top with imports
from werkzeug.security import generate_password_hash
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from datetime import datetime, timedelta

from email_utils import send_priority_support_ticket
from email_utils import send_branded_customer_reply
from email_utils import send_feedback_submission

from flask_jwt_extended import JWTManager
from flask_jwt_extended import create_access_token
from datetime import timedelta
from datetime import datetime


from flask_jwt_extended.exceptions import NoAuthorizationError


import pytz
import os
import secrets

name_pool = [
    ("Naomi", "Davis"),
    ("Ava", "Patel"),
    ("Jasmine", "Nguyen"),
    ("Lily", "Chen"),
    ("Amber", "Lee"),
    ("Maya", "Ali"),
    ("Zara", "Hassan"),
    ("Sasha", "Brown"),
    ("Tina", "Park"),
    ("Emily", "Wright"),
    ("Grace", "Lopez"),
    ("Olivia", "Smith"),
    ("Liam", "Johnson"),
    ("Noah", "Williams"),
    ("Elijah", "Rodriguez"),
    ("Aiden", "Chen"),
    ("Mateo", "Ramirez"),
    ("Ethan", "Hernandez"),
    ("Logan", "Nguyen"),
    ("Lucas", "Carter"),
    ("Jayden", "Kim"),
    ("Sebastian", "Singh"),
    ("Julian", "Wang"),
    ("Isaac", "Diaz"),
]

load_dotenv()

app = Flask(__name__)
CORS(
    app,
    resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-Dev-Auth"],
)

app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=1000)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///scheduler.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
jwt = JWTManager(app)

with app.app_context():
    db.create_all()

serializer = URLSafeTimedSerializer(os.getenv("SECRET_KEY", "super-secret"))


def is_valid_public_slug(path):
    """
    Only match slugs like '/ambercafe' if they exist in DB.
    """
    if not re.fullmatch(r"/[a-z0-9_-]{3,30}", path):
        return False

    slug = path.lstrip("/")
    return Freelancer.query.filter_by(custom_url=slug).first() is not None


def eastern_today():
    est = pytz.timezone("US/Eastern")
    return datetime.now(est).date()


from flask import make_response

from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from flask_jwt_extended.exceptions import NoAuthorizationError
from flask_jwt_extended import jwt_required


@app.before_request
def load_freelancer():
    print("🔥 Path:", request.path)
    print("🔥 Headers:", dict(request.headers))

    if request.method == "OPTIONS":
        return

    open_prefixes = (
        "/auth",
        "/signup",
        "/seed",
        "/verify",
        "/dev",
        "/404",
        "/master-times",
    )
    open_paths = [
        "/freelancer/public-info",
        "/freelancer/slots",
        "/book",
        "/test-email",
        "/feedback",
        "/confirm-booking",
        "/appointment",
        "/download-ics"
    ]

    if (
        any(request.path.startswith(prefix) for prefix in open_prefixes)
        or any(
            request.path.startswith(path + "/") or request.path == path
            for path in open_paths
        )
        or request.endpoint == "public_profile_by_url"
        or is_valid_public_slug(request.path)
        or request.path == "/404"
    ):
        print("✅ Skipping auth for open or public path.")
        return

    try:
        verify_jwt_in_request()
        g.freelancer_id = get_jwt_identity()
        print("✅ Authenticated as freelancer:", g.freelancer_id)
    except NoAuthorizationError:
        print("❌ Missing or invalid JWT token")
        return jsonify({"error": "Missing or invalid token"}), 401


@app.route("/")
def index():
    return jsonify({"message": "Server is running!"})


@app.route("/freelancer/slots/<int:freelancer_id>", methods=["GET"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
def get_public_time_slots(freelancer_id):
    from sqlalchemy.orm import joinedload

    if request.method == "OPTIONS":
        return jsonify({}), 200

    # Fetch all master times in order to map time labels to IDs
    master_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_label_to_id = {mt.label: mt.id for mt in master_times}
    time_labels = [mt.label for mt in master_times]

    # Precompute inherited slot IDs
    inherited_ids = set()
    appointments = (
        Appointment.query.filter_by(freelancer_id=freelancer_id)
        .filter(Appointment.status != "cancelled")
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
        is_booked = slot.is_booked
        is_inherited = slot.id in inherited_ids
        appointment = slot.appointment
        user_info = None
        service_name = None
        duration_minutes = None

        if is_booked and appointment and not is_inherited:
            user = appointment.user
            service = appointment.service
            if user:
                user_info = {
                    "name": f"{user.first_name} {user.last_name}",
                    "email": user.email,
                }
            if service:
                service_name = service.name
                duration_minutes = service.duration_minutes

        result.append(
            {
                "id": slot.id,
                "time": slot.master_time.label,
                "day": slot.day,
                "is_booked": is_booked,
                "is_inherited_block": is_inherited,
                "appointment": user_info,
                "service_name": service_name,
                "duration_minutes": duration_minutes,
            }
        )

    return jsonify(result)


@app.route("/book", methods=["POST"])
def book_slot():
    data = request.get_json()
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    phone = data.get("phone")
    slot_id = data.get("slot_id")
    service_id = data.get("service_id")

    if not first_name or not last_name or not email or not slot_id or not service_id:
        return jsonify({"error": "Missing required fields"}), 400

    slot = TimeSlot.query.get(slot_id)
    if not slot or slot.is_booked:
        return jsonify({"error": "Slot is unavailable"}), 400

    service = Service.query.get(service_id)
    if not service:
        return jsonify({"error": "Invalid service selected"}), 400

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
    existing_unconfirmed = Appointment.query.filter_by(
        user_id=user.id, freelancer_id=slot.freelancer_id, status="pending"
    ).first()
    if existing_unconfirmed:
        return (
            jsonify(
                {
                    "error": "You already have a pending booking. Please confirm or cancel it before making another."
                }
            ),
            400,
        )

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

    # Atomic booking logic starts here
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]
    duration_blocks = service.duration_minutes // 15
    start_label = slot.master_time.label

    try:
        start_index = time_labels.index(start_label)
    except ValueError:
        return jsonify({"error": "Invalid slot time"}), 400

    required_labels = time_labels[start_index : start_index + duration_blocks]
    if len(required_labels) < duration_blocks:
        return jsonify({"error": "Not enough consecutive blocks"}), 400

    conflicts = (
        TimeSlot.query.join(MasterTimeSlot)
        .filter(
            TimeSlot.freelancer_id == slot.freelancer_id,
            TimeSlot.day == slot.day,
            MasterTimeSlot.label.in_(required_labels),
            TimeSlot.is_booked == True,
        )
        .all()
    )
    if conflicts:
        return (
            jsonify({"error": "Selected time conflicts with an existing booking."}),
            400,
        )

    appointment = Appointment(
        slot_id=slot_id,
        freelancer_id=slot.freelancer_id,
        user_id=user.id,
        service_id=service_id,
        status="pending",
        email=email,  # <- NEW
        phone=phone,
        timestamp=datetime.utcnow(),
    )
    db.session.add(appointment)

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

    db.session.commit()

    from email_utils import (
        send_branded_customer_reply,
    )  # ✅ make sure this is at the top

    token = serializer.dumps({"appointment_id": appointment.id}, salt="booking-confirm")
    link = f"http://127.0.0.1:5000/confirm-booking/{token}"

    subject = "Confirm Your Appointment – SlotMe"
    body = f"""Hi {first_name},

    Thanks for booking with SlotMe!

    You're one step away from confirming your appointment. Just click the link below:

    {link}

    If you didn’t make this request, feel free to ignore this email.

    – The SlotMe Team
    """

    try:
        send_branded_customer_reply(subject, body, email)
    except Exception as e:
        print("❌ Failed to send confirmation email:", e)

    return jsonify({"message": "Verification email sent."}), 200


@app.route("/appointments", methods=["GET", "OPTIONS"])
@cross_origin(
    origins="http://localhost:5173",
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
)
@jwt_required()
def get_appointments():
    freelancer_id = int(g.freelancer_id)
    appointments = Appointment.query.filter_by(freelancer_id=freelancer_id).all()
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
                "freelancer_timezone": "America/New_York",  # or dynamic later
                "service": a.service.name if a.service else None,  # ✅ add this
                "service_duration_minutes": (
                    a.service.duration_minutes if a.service else None
                ),  # ✅ and this
            }
        )

    return jsonify(result)


@app.route("/appointments/<int:id>", methods=["PATCH", "OPTIONS"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@jwt_required()
def update_appointment(id):
    freelancer_id = int(g.freelancer_id)
    data = request.get_json()

    appointment = Appointment.query.get(id)

    # 👇 Insert this block right here
    print("🔎 Attempting to update appointment ID:", id)
    if not appointment:
        print("❌ Appointment not found in SQLAlchemy session.")
    else:
        print(
            f"✅ Found appointment. ID: {appointment.id}, Freelancer ID: {appointment.freelancer_id}, Status: {appointment.status}"
        )
        if appointment.freelancer_id != freelancer_id:
            print(
                f"🚫 Auth mismatch: JWT freelancer {freelancer_id} does not match appointment.freelancer_id {appointment.freelancer_id}"
            )

    if not appointment or appointment.freelancer_id != freelancer_id:
        return jsonify({"error": "Appointment not found or unauthorized"}), 404

    # 🔁 Change status (e.g., to "cancelled")
    if "status" in data:
        new_status = data["status"]
        if new_status not in ["pending", "confirmed", "cancelled"]:
            return jsonify({"error": "Invalid status value"}), 400
        appointment.status = new_status
        if new_status == "cancelled":
            appointment.slot.is_booked = False  # Free the slot

    # 🔁 Optionally support rescheduling
    if "slot_id" in data:
        new_slot_id = data["slot_id"]
        new_slot = TimeSlot.query.get(new_slot_id)
        if not new_slot or new_slot.freelancer_id != freelancer_id:
            return jsonify({"error": "Invalid new slot"}), 404
        if new_slot.is_booked:
            return jsonify({"error": "Time slot is already booked"}), 400

        # Swap slots
        old_slot = appointment.slot
        old_slot.is_booked = False
        appointment.slot_id = new_slot_id
        new_slot.is_booked = True

    print(f"🛠 Appointment {id} updated to status: {appointment.status}")

    db.session.commit()
    return jsonify({"message": "Appointment updated successfully."}), 200


@app.route("/auth", methods=["POST"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
def freelancer_login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer or not check_password_hash(freelancer.password, password):
        return jsonify({"error": "Invalid login"}), 401

    # ✅ Issue JWT token
    access_token = create_access_token(identity=str(freelancer.id))

    return (
        jsonify(
            {
                "access_token": access_token,
                "freelancer_id": freelancer.id,  # optional, for convenience
            }
        ),
        200,
    )


@app.route("/dev/freelancers", methods=["GET"])
def get_all_freelancers():
    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancers = Freelancer.query.all()
    result = []
    for c in freelancers:
        result.append(
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "logo_url": c.logo_url,
                "tagline": c.tagline,
                "bio": c.bio,
                "is_verified": c.is_verified,
            }
        )
    return jsonify(result)


@app.route("/dev/slots/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_freelancer_slots(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    from sqlalchemy.orm import joinedload

    # Fetch master times in order to get consistent time label order
    master_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_label_to_id = {mt.label: mt.id for mt in master_times}
    time_labels = [mt.label for mt in master_times]

    # Precompute inherited block IDs
    inherited_ids = set()
    appointments = (
        Appointment.query.filter_by(freelancer_id=freelancer_id)
        .filter(Appointment.status != "cancelled")
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

    # Load all slots
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
        is_booked = slot.is_booked
        is_inherited = slot.id in inherited_ids
        appointment = slot.appointment
        user_info = None
        service_name = None
        duration_minutes = None

        if is_booked and appointment and not is_inherited:
            user = appointment.user
            service = appointment.service
            if user:
                user_info = {
                    "name": f"{user.first_name} {user.last_name}",
                    "email": user.email,
                }
            if service:
                service_name = service.name
                duration_minutes = service.duration_minutes

        result.append(
            {
                "id": slot.id,
                "time": slot.master_time.label,
                "day": slot.day,
                "is_booked": is_booked,
                "is_inherited_block": is_inherited,
                "appointment": user_info,
                "service_name": service_name,
                "duration_minutes": duration_minutes,
            }
        )

    return jsonify(result)


@app.route("/dev/freelancers/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_single_freelancer(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancer = Freelancer.query.get(freelancer_id)
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
    ]

    return jsonify(
        {
            "id": freelancer.id,
            "first_name": freelancer.first_name,
            "last_name": freelancer.last_name,
            "email": freelancer.email,
            "phone": freelancer.phone,
            "logo_url": freelancer.logo_url,
            "tagline": freelancer.tagline,
            "bio": freelancer.bio,
            "instagram_url": freelancer.instagram_url,
            "twitter_url": freelancer.twitter_url,
            "is_verified": freelancer.is_verified,
            "joined": freelancer.id,  # Replace with created_at if desired
            "services": service_data,
            "faq_text": freelancer.faq_text,
        }
    )


@app.route("/dev/appointments/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_dev_appointments_for_freelancer(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200  # ✅ Allow CORS preflight

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    appointments = Appointment.query.filter_by(freelancer_id=freelancer_id).all()
    result = []
    for a in appointments:
        result.append(
            {
                "id": a.id,
                "name": a.user.name if a.user else None,
                "email": a.user.email if a.user else None,
                "slot_day": a.slot.day,
                "slot_time": a.slot.master_time.label,  # ✅ FIXED: use master_time.label
                "status": a.status,
            }
        )

    return jsonify(result)


@app.route("/dev/freelancers", methods=["POST"])
def create_freelancer():
    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    if Freelancer.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    new_freelancer = Freelancer(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=generate_password_hash(password),
    )
    db.session.add(new_freelancer)
    db.session.commit()
    return jsonify({"message": "Freelancer created!"}), 201


@app.route("/dev/freelancers/<int:freelancer_id>", methods=["DELETE", "OPTIONS"])
def delete_freelancer(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200  # Preflight OK

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    Appointment.query.filter_by(freelancer_id=freelancer_id).delete()
    TimeSlot.query.filter_by(freelancer_id=freelancer_id).delete()
    db.session.delete(freelancer)
    db.session.commit()
    return jsonify({"message": "Freelancer deleted"})


@app.route("/freelancer/public-info/<int:freelancer_id>", methods=["GET", "OPTIONS"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
def get_public_freelancer_info(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    freelancer = Freelancer.query.get(freelancer_id)
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
            "logo_url": freelancer.logo_url,
            "tagline": freelancer.tagline,
            "bio": freelancer.bio,
            "faq_text": freelancer.faq_text,
            "timezone": freelancer.timezone,
            "is_verified": freelancer.is_verified,
            "email": freelancer.contact_email,
            "phone": freelancer.phone,
            "instagram_url": freelancer.instagram_url,
            "twitter_url": freelancer.twitter_url,
            "no_show_policy": freelancer.no_show_policy,
            "created_at": freelancer.created_at.isoformat(),
            "services": service_data,  # ✅ ADD THIS
        }
    )


@app.route("/slots", methods=["POST"])
@jwt_required()
def create_time_slot():
    freelancer_id = int(g.freelancer_id)
    data = request.get_json()

    day = data.get("day")  # "YYYY-MM-DD"
    master_time_id = data.get("master_time_id")

    if not day or not master_time_id:
        return jsonify({"error": "Missing day or master_time_id"}), 400

    from models import MasterTimeSlot

    master_time = MasterTimeSlot.query.get(master_time_id)
    if not master_time:
        return jsonify({"error": "Invalid master time ID"}), 400

    existing = TimeSlot.query.filter_by(
        freelancer_id=freelancer_id, day=day, master_time_id=master_time_id
    ).first()

    if existing:
        return jsonify({"error": "Time slot already exists"}), 400

    # ✅ NEW: Check if this time block overlaps with any appointment's duration
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    target_label = master_time.label
    time_labels = [t.label for t in all_times]
    target_index = (
        time_labels.index(target_label) if target_label in time_labels else -1
    )

    is_booked = False

    if target_index != -1:
        from sqlalchemy.orm import joinedload

        appointments = (
            Appointment.query.options(
                joinedload(Appointment.slot).joinedload(TimeSlot.master_time),
                joinedload(Appointment.service),
            )
            .filter_by(freelancer_id=freelancer_id)
            .filter(Appointment.status != "cancelled")
            .all()
        )

        for appt in appointments:
            slot_time = appt.slot.master_time.label
            duration = appt.service.duration_minutes
            blocks = duration // 15

            try:
                appt_start = time_labels.index(slot_time)
                appt_labels = time_labels[appt_start : appt_start + blocks]
                if target_label in appt_labels:
                    is_booked = True
                    break
            except ValueError:
                continue

    # Optionally update freelancer's timezone if provided
    timezone = data.get("timezone")
    if timezone:
        freelancer = Freelancer.query.get(freelancer_id)
        if freelancer:
            freelancer.timezone = timezone
            db.session.commit()

    # Create the slot (with is_booked = True if it conflicts with any appointment block)
    slot = TimeSlot(
        day=day,
        master_time_id=master_time_id,
        freelancer_id=freelancer_id,
        is_booked=is_booked,
    )
    db.session.add(slot)
    db.session.commit()

    return (
        jsonify(
            {"message": "Time slot created", "slot_id": slot.id, "booked": is_booked}
        ),
        201,
    )


@app.route("/slots/<int:slot_id>", methods=["DELETE"])
@jwt_required()
def delete_time_slot(slot_id):
    freelancer_id = int(g.freelancer_id)
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


@app.route("/verify/<token>", methods=["GET"])
def verify_booking(token):
    try:
        data = serializer.loads(token, max_age=3600)  # 1 hour expiry
        appointment_id = data["appointment_id"]
    except:
        return jsonify({"error": "Invalid or expired token"}), 400

    appt = Appointment.query.get(appointment_id)
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404

    appt.status = "confirmed"
    db.session.commit()
    return redirect("http://localhost:5173/thank-you")  # Adjust if hosted


@app.route("/master-times", methods=["GET"])
def get_master_time_slots():
    from models import MasterTimeSlot

    times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    result = [{"id": t.id, "label": t.label, "time_24h": t.time_24h} for t in times]
    return jsonify(result)


@cross_origin(origins="http://localhost:5173")
@app.route("/freelancers/<int:freelancer_id>", methods=["GET"])
def public_freelancer_profile(freelancer_id):
    freelancer = Freelancer.query.get(freelancer_id)
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
            "is_verified": freelancer.is_verified,
            "joined": freelancer.id,
            "services": service_data,
            "faq_text": freelancer.faq_text,
        }
    )


@app.route("/freelancer/services", methods=["GET", "OPTIONS"])
@cross_origin(
    origins="http://localhost:5173", headers=["Content-Type", "Authorization"]
)
@jwt_required()
def get_services():
    if request.method == "OPTIONS":
        return "", 200

    freelancer_id = int(g.freelancer_id)
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


@app.route("/freelancer/services", methods=["POST", "OPTIONS"])
@cross_origin(
    origins="http://localhost:5173", headers=["Content-Type", "Authorization"]
)
@jwt_required()
def add_service():
    if request.method == "OPTIONS":
        return "", 200

    freelancer_id = int(g.freelancer_id)
    if not freelancer_id:
        return jsonify({"error": "Missing freelancer ID"}), 403

    data = request.get_json()
    name = data.get("name")
    description = data.get("description", "")
    duration_minutes = data.get("duration_minutes")
    price_usd = data.get("price_usd")

    if not name or not duration_minutes:
        return jsonify({"error": "Missing required fields"}), 400

    if price_usd is None:
        return jsonify({"error": "Price is required"}), 400

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


@app.route("/freelancer/services/<int:service_id>", methods=["DELETE", "OPTIONS"])
@cross_origin(
    origins="http://localhost:5173", headers=["Content-Type", "Authorization"]
)
@jwt_required()
def delete_service(service_id):
    if request.method == "OPTIONS":
        return "", 200

    service = Service.query.get(service_id)
    db.session.delete(service)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@app.route("/freelancer/services/<int:service_id>", methods=["PATCH", "OPTIONS"])
@cross_origin(
    origins="http://localhost:5173", headers=["Content-Type", "Authorization"]
)
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


@app.route("/freelancer/analytics", methods=["GET"])
@jwt_required()
def get_analytics():
    freelancer_id = int(g.freelancer_id)
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


@app.route("/freelancer/support", methods=["POST"])
@jwt_required()
def send_support_request():
    freelancer_id = int(g.freelancer_id)
    data = request.get_json()
    subject = data.get("subject", "No Subject")
    message = data.get("message", "")

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404
    if freelancer.tier != "elite":
        return jsonify({"error": "Only elite tier can access support"}), 403

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
        Name: {freelancer.name}
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


@app.route("/freelancer/reply", methods=["POST"])
@jwt_required()
def reply_to_customer():
    freelancer_id = int(g.freelancer_id)
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


@app.route("/<string:custom_url>", methods=["GET"])
def public_profile_by_url(custom_url):
    # 👇 Prevent conflict with real routes like /404
    reserved_routes = {
        "404",
        "slots",
        "book",
        "auth",
        "seed",
        "verify",
        "master-times",
        "freelancer",
        "freelancers",
        "dev",
    }

    if custom_url in reserved_routes:
        return handle_404(None)

    freelancer = Freelancer.query.filter_by(custom_url=custom_url).first()
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
            "is_verified": freelancer.is_verified,
            "joined": freelancer.created_at.strftime("%-m/%-d/%y"),
            "services": service_data,
            "faq_text": freelancer.faq_text,
        }
    )


@app.route("/freelancer/branding", methods=["PATCH"])
@jwt_required()
def update_freelancer_branding():
    print("🔥 Incoming PATCH payload:", request.json)
    freelancer_id = int(g.freelancer_id)
    data = request.get_json()
    freelancer = Freelancer.query.get(freelancer_id)

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    freelancer.first_name = data.get("first_name", freelancer.first_name)
    freelancer.last_name = data.get("last_name", freelancer.last_name)
    freelancer.business_name = data.get("business_name", freelancer.business_name)
    freelancer.business_address = data.get(
        "business_address", freelancer.business_address
    )
    freelancer.logo_url = data.get("logo_url", freelancer.logo_url)
    freelancer.bio = data.get("bio", freelancer.bio)
    freelancer.tagline = data.get("tagline", freelancer.tagline)
    freelancer.timezone = data.get("timezone", freelancer.timezone)
    freelancer.no_show_policy = data.get("no_show_policy", freelancer.no_show_policy)
    freelancer.faq_text = data.get("faq_text", freelancer.faq_text)

    # ✅ Handle custom URL update
    if "custom_url" in data:
        new_url = data["custom_url"].strip().lower()

        if new_url:  # Only validate if it's not empty
            if not re.match(r"^[a-z0-9_-]{3,30}$", new_url):
                return (
                    jsonify(
                        {
                            "error": "Custom URL must be 3-30 characters, letters/numbers/dashes only."
                        }
                    ),
                    400,
                )

            if new_url != freelancer.custom_url:
                if Freelancer.query.filter(Freelancer.custom_url == new_url).first():
                    return jsonify({"error": "Custom URL is already taken."}), 400

            freelancer.custom_url = new_url
        else:
            # Optional: allow clearing the custom URL if desired
            freelancer.custom_url = ""

    db.session.commit()
    return jsonify({"message": "Branding updated"})


@app.errorhandler(404)
def handle_404(e):
    origin = request.headers.get("Origin", "*")
    response = jsonify({"error": "Not found"})
    response.status_code = 404
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, Authorization, X-Dev-Auth"
    )
    response.headers["Access-Control-Allow-Methods"] = (
        "GET, POST, PATCH, DELETE, OPTIONS"
    )
    return response


@app.route("/404")
def hardcoded_404():
    return jsonify({"error": "Not found"}), 404


# SEEDME
@app.route("/dev/seed-all", methods=["POST"])
def seed_everything():
    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    from models import MasterTimeSlot
    from werkzeug.security import generate_password_hash
    from random import choice

    # 1. Seed 96 master time slots
    db.session.query(MasterTimeSlot).delete()
    start_time = datetime.strptime("00:00", "%H:%M")
    delta = timedelta(minutes=15)
    for i in range(96):
        time_24h = (start_time + i * delta).strftime("%H:%M")
        label = (start_time + i * delta).strftime("%I:%M %p")
        db.session.add(MasterTimeSlot(time_24h=time_24h, label=label))
    db.session.commit()

    # 2. Seed demo freelancer (2 appointments: Jane & John)
    f1 = Freelancer.query.filter_by(email="demo@mail.com").first()
    if not f1:
        f1 = Freelancer(
            first_name="Amber",
            last_name="Gyser",
            business_name="Amber's Love Cafe",
            email="demo@mail.com",
            password=generate_password_hash("demo123"),
            logo_url="https://randomuser.me/api/portraits/women/45.jpg",
            tagline='Let\'s grab "Hot Coffee". Night bookings only...',
            bio="Currently in Charlotte, NC!",
            is_verified=False,
            phone="555-123-4567",
            contact_email="booking@ambercafe.com",
            instagram_url="https://instagram.com/zuck",
            twitter_url="https://twitter.com/elonmusk",
            no_show_policy="Cancel 24h ahead.",
            faq_text="• $10 deposit\n• Come early\n• No-shows forfeit deposit.",
            early_access=False,
        )
        db.session.add(f1)
        db.session.commit()

    Appointment.query.filter_by(freelancer_id=f1.id).delete()
    TimeSlot.query.filter_by(freelancer_id=f1.id).delete()
    Service.query.filter_by(freelancer_id=f1.id).delete()
    db.session.commit()

    db.session.add_all(
        [
            Service(
                freelancer_id=f1.id,
                name="Café au Lay",
                description="Coffee body contact.",
                duration_minutes=45,
                price_usd=50.00,
            ),
            Service(
                freelancer_id=f1.id,
                name="Espresso Eiffel Tower",
                description="For threesomes.",
                duration_minutes=30,
                price_usd=70.00,
            ),
        ]
    )
    db.session.commit()

    today = eastern_today()
    demo_bookings = [
        ("Jane", "Doe", "jane.doe@mail.com", "09:00 AM", 45),
        ("John", "Doe", "john.doe@mail.com", "10:00 AM", 30),
    ]
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]
    demo_services = Service.query.filter_by(freelancer_id=f1.id).all()

    for first, last, email, start_label, duration in demo_bookings:
        mt_start = MasterTimeSlot.query.filter_by(label=start_label).first()
        if not mt_start:
            continue
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(first_name=first, last_name=last, email=email)
            db.session.add(user)
            db.session.commit()

        service = next(
            (s for s in demo_services if s.duration_minutes == duration), None
        )
        if not service:
            continue

        start_slot = TimeSlot(
            day=today.isoformat(),
            master_time_id=mt_start.id,
            freelancer_id=f1.id,
            is_booked=True,
        )
        db.session.add(start_slot)
        db.session.commit()

        appt = Appointment(
            slot_id=start_slot.id,
            freelancer_id=f1.id,
            user_id=user.id,
            service_id=service.id,
            status="confirmed",
            timestamp=datetime.now(),
        )
        db.session.add(appt)

        start_index = time_labels.index(start_label)
        required_labels = time_labels[start_index : start_index + (duration // 15)]
        for label in required_labels[1:]:
            mt = next((t for t in all_times if t.label == label), None)
            if not mt:
                continue
            existing = TimeSlot.query.filter_by(
                day=today.isoformat(),
                freelancer_id=f1.id,
                master_time_id=mt.id,
            ).first()
            if not existing:
                db.session.add(
                    TimeSlot(
                        day=today.isoformat(),
                        freelancer_id=f1.id,
                        master_time_id=mt.id,
                        is_booked=True,
                    )
                )
    db.session.commit()

    # ✅ REWRITE ELITE FREELANCER SEEDING TO BE ATOMIC
    f2 = Freelancer.query.filter_by(email="night@mail.com").first()
    if not f2:
        f2 = Freelancer(
            first_name="Ping",
            last_name="Xioma",
            business_name="Ping's Slippery Massage",
            email="night@mail.com",
            password=generate_password_hash("night123"),
            logo_url="https://thumbs.dreamstime.com/b/portrait-beautiful-asian-woman-natural-beauty-face-thai-girl-tanned-skin-full-lips-high-resolution-137168110.jpg",
            tagline="I milk you, we have fun time!",
            bio="Trained in Bangkok. Open late.",
            is_verified=True,
            phone="555-987-6543",
            contact_email="contact@pingmassage.com",
            instagram_url="https://instagram.com/zuck",
            twitter_url="https://twitter.com/elonmusk",
            no_show_policy="Reschedule 12h ahead.",
            faq_text="• Bridal trials\n• Travel fees apply",
            tier="elite",
            early_access=True,
        )
        db.session.add(f2)
        db.session.commit()

        db.session.add_all(
            [
                Service(
                    freelancer_id=f2.id,
                    name="Happy Ending Herbal Rubdown",
                    description="Start stiff, leave smiling.",
                    duration_minutes=60,
                    price_usd=79.99,
                ),
                Service(
                    freelancer_id=f2.id,
                    name="Thai Five-Hand Combo",
                    description="Two-hour escape.",
                    duration_minutes=120,
                    price_usd=149.99,
                ),
            ]
        )
        db.session.commit()

    services = Service.query.filter_by(freelancer_id=f2.id).all()
    elite_bookings = [
        (datetime.now().date() + timedelta(days=i)).isoformat()
        for i in range(5)
        for _ in range(3)
    ]

    for day_str in elite_bookings:
        label = choice(time_labels[:-8])
        mt_start = MasterTimeSlot.query.filter_by(label=label).first()
        if not mt_start:
            continue

        service = choice(services)
        duration = service.duration_minutes
        start_index = time_labels.index(label)
        required_labels = time_labels[start_index : start_index + (duration // 15)]

        slot = TimeSlot(
            day=day_str,
            master_time_id=mt_start.id,
            freelancer_id=f2.id,
            is_booked=True,
        )
        db.session.add(slot)
        db.session.commit()

        first, last = choice(name_pool)
        email = f"{first.lower()}.{last.lower()}@mail.com"
        user = User(first_name=first, last_name=last, email=email)
        db.session.add(user)
        db.session.commit()

        appt = Appointment(
            slot_id=slot.id,
            freelancer_id=f2.id,
            user_id=user.id,
            service_id=service.id,
            status="confirmed",
            timestamp=datetime.now(),
        )
        db.session.add(appt)

        for label in required_labels[1:]:
            mt = next((t for t in all_times if t.label == label), None)
            if not mt:
                continue
            existing = TimeSlot.query.filter_by(
                day=day_str,
                freelancer_id=f2.id,
                master_time_id=mt.id,
            ).first()
            if not existing:
                db.session.add(
                    TimeSlot(
                        day=day_str,
                        freelancer_id=f2.id,
                        master_time_id=mt.id,
                        is_booked=True,
                    )
                )
    db.session.commit()

    print("Demo freelancer ID:", f1.id)
    print("Elite freelancer ID:", f2.id)

    token1 = create_access_token(identity=str(f1.id))
    token2 = create_access_token(identity=str(f2.id))

    return (
        jsonify(
            {
                "message": "✅ Fully seeded: master times, both freelancers, and bookings.",
                "demo_token": token1,
                "elite_token": token2,
            }
        ),
        200,
    )


# SEEDME


@app.route("/freelancer-info", methods=["GET"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@jwt_required()
def get_freelancer_info():
    freelancer_id = int(g.freelancer_id)
    freelancer = Freelancer.query.get(freelancer_id)

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    return (
        jsonify(
            {
                "id": freelancer.id,
                "first_name": freelancer.first_name,
                "last_name": freelancer.last_name,
                "business_name": freelancer.business_name,
                "logo_url": freelancer.logo_url,
                "tagline": freelancer.tagline,
                "bio": freelancer.bio,
                "timezone": freelancer.timezone,
                "is_verified": freelancer.is_verified,
                "business_address": freelancer.business_address,
            }
        ),
        200,
    )


@app.route("/dev/send-confirmation/<int:freelancer_id>", methods=["POST"])
@cross_origin()
def send_confirmation_email(freelancer_id):
    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    token = serializer.dumps(freelancer.email, salt="email-confirm")
    freelancer.confirmation_token = token
    db.session.commit()

    confirm_url = f"http://localhost:5173/verify-freelancer?token={token}"
    print(f"🔗 Confirmation link: {confirm_url}")

    send_feedback_submission(
        to=freelancer.email,
        subject="Please confirm your SlotMe email",
        body=f"Click here to confirm: {confirm_url}",
    )

    return jsonify({"message": "Email sent!"}), 200


@app.route("/verify-email", methods=["GET"])
@cross_origin()
def verify_email():
    token = request.args.get("token")
    try:
        email = serializer.loads(token, salt="email-confirm", max_age=3600)
    except:
        return jsonify({"error": "Invalid or expired token"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    freelancer.email_confirmed = True
    freelancer.confirmation_token = None
    db.session.commit()

    return jsonify({"message": "Email confirmed successfully!"}), 200


@app.route("/signup", methods=["POST"])
@cross_origin(origins="http://localhost:5173")  # 👈 Add this decorator
def signup_freelancer():
    data = request.get_json()
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    if Freelancer.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    hashed = generate_password_hash(password)

    new_freelancer = Freelancer(
        first_name=first_name,
        last_name=last_name,
        email=email,
        contact_email=email,
        password=hashed,
        email_confirmed=False,
    )

    db.session.add(new_freelancer)
    db.session.commit()

    # 🔗 Generate confirmation token and send email
    token = serializer.dumps(email, salt="email-confirm")
    new_freelancer.confirmation_token = token
    db.session.commit()

    confirm_url = f"http://localhost:5173/verify-freelancer?token={token}"
    print(f"📨 Confirmation URL: {confirm_url}")

    # ✅ Send verification email
    send_feedback_submission(
        to=email,
        subject="Verify Your SlotMe Account",
        body=f"""Hey {first_name},

    Thanks for signing up for SlotMe!

    Before you can log in, please confirm your email address by clicking the link below:
    http://localhost:5173/signup-confirmed

    Once confirmed, you’ll have access to your dashboard and can start booking clients.

    – The SlotMe Team
    """,
    )

    return (
        jsonify({"message": "Signup successful! Please check your email to confirm."}),
        201,
    )


@app.route("/test-email", methods=["GET", "POST"])
def test_email():
    try:
        send_feedback_submission(
            "heyitsjusttom@gmail.com",
            "🔥 SlotMe SMTP Test #merab",
            "This is a test email from your SlotMe app.",
        )
        return jsonify({"message": "Test email sent successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/feedback", methods=["POST", "OPTIONS"])
def send_feedback():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    data = request.get_json()
    name = data.get("name", "Anonymous")
    email = data.get("email", "unknown@user.com")
    subject = data.get("subject", "No Subject")
    message = data.get("message", "")
    reason = data.get("reason", "General")

    if "@" not in email:
        email = "unknown@user.com"

    body = f"""
Name: {name}
Email: {email}
Reason: {reason}

Message:
{message}
""".strip()

    try:
        send_feedback_submission(
            to=os.getenv("SUPPORT_EMAIL"),  # e.g. support@slotme.xyz
            subject=f"[PUBLIC | {reason}] {subject}",
            body=body,
        )
        return jsonify({"message": "Feedback sent successfully!"}), 200
    except Exception as e:
        print("❌ Feedback email failed:", str(e))
        return jsonify({"error": "Failed to send feedback"}), 500


@app.route("/freelancer/batch-slots", methods=["POST"])
@cross_origin(origins="http://localhost:5173", supports_credentials=True)
@jwt_required()
def create_batch_slots():
    data = request.get_json()
    freelancer_id = get_jwt_identity()
    day = data.get("day")
    start_time = data.get("start_time")  # e.g., "12:00 PM"
    end_time = data.get("end_time")  # e.g., "7:00 PM"
    interval = int(data.get("interval", 15))

    master_times = MasterTimeSlot.query.order_by(MasterTimeSlot.time_24h).all()
    time_labels = [t.label for t in master_times]

    # Load appointment time blocks
    appointments = (
        Appointment.query.join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .filter(TimeSlot.day == day)  # <- only slots on the selected day
        .filter(Appointment.freelancer_id == freelancer_id)
        .filter(Appointment.status != "cancelled")
        .all()
    )
    booked_labels = set()
    for appt in appointments:
        slot = TimeSlot.query.get(appt.slot_id)
        service = Service.query.get(appt.service_id)
        if not slot or not service:
            continue
        try:
            start_label = MasterTimeSlot.query.get(slot.master_time_id).label
            start_index = time_labels.index(start_label)
            blocks = service.duration_minutes // 15
            for lbl in time_labels[start_index : start_index + blocks]:
                booked_labels.add(lbl)
        except:
            continue

    # Build time block list from start to end
    times_to_create = []
    in_range = False
    for label in time_labels:
        if label == start_time:
            in_range = True
        if in_range:
            if label == end_time:
                break  # don't include the endpoint
            times_to_create.append(label)
    times_to_create = times_to_create[:: interval // 15]

    created = []
    label_to_master_id = {m.label: m.id for m in master_times}

    existing_ids = {
        s.master_time_id
        for s in TimeSlot.query.filter_by(freelancer_id=freelancer_id, day=day).all()
    }

    created = []
    for label in times_to_create:
        master_id = label_to_master_id.get(label)
        if not master_id or master_id in existing_ids:
            continue

        is_booked = label in booked_labels

        new_slot = TimeSlot(
            freelancer_id=freelancer_id,
            day=day,
            master_time_id=master_id,
            is_booked=is_booked,
        )
        db.session.add(new_slot)
        created.append(label)

    db.session.commit()
    return jsonify({"message": f"{len(created)} slots created", "slots": created}), 201


# Create serializer (add near your config)
serializer = URLSafeTimedSerializer(os.getenv("SECRET_KEY"))


@app.route("/confirm-booking/<token>", methods=["GET"])
@cross_origin(origins="*")
def confirm_booking_email(token):
    try:
        data = serializer.loads(token, salt="booking-confirm", max_age=86400)
        appointment_id = data["appointment_id"]
    except SignatureExpired:
        return redirect("http://localhost:5173/expired")
    except BadSignature:
        return redirect("http://localhost:5173/invalid")

    appointment = Appointment.query.get(appointment_id)

    if appointment and appointment.status == "pending":
        appointment.status = "confirmed"
        db.session.commit()

        # ✅ Send confirmation receipt email
        user = appointment.user
        freelancer = appointment.freelancer
        service = appointment.service
        slot = appointment.slot

        formatted_date = datetime.strptime(slot.day, "%Y-%m-%d").strftime(
            "%A, %B %d, %Y"
        )
        formatted_time = slot.master_time.label

        # ⏰ Google Calendar Link
        start_datetime = f"{slot.day}T{slot.master_time.time_24h}:00"
        duration = service.duration_minutes
        end_dt = datetime.strptime(start_datetime, "%Y-%m-%dT%H:%M:%S") + timedelta(
            minutes=duration
        )
        end_datetime = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

        title = f"{freelancer.business_name or 'Appointment'} with {user.first_name}"
        details = f"Service: {service.name}\\nBooked via SlotMe"
        location = freelancer.business_address or "Online"

        calendar_url = (
            "https://calendar.google.com/calendar/render?action=TEMPLATE"
            f"&text={title}"
            f"&dates={start_datetime.replace('-', '').replace(':', '')}/{end_datetime.replace('-', '').replace(':', '')}"
            f"&details={details}"
            f"&location={location}"
        )

        subject = "📅 Your Appointment is Confirmed – SlotMe"
        body = f"""Hi {user.first_name},

Thanks for confirming your booking!

✅ Appointment Details:
• Freelancer: {freelancer.business_name or "your freelancer"}
• Service: {service.name}
• Date: {formatted_date}
• Time: {formatted_time} (EST)
"""

        if freelancer.business_address:
            body += f"• Location: {freelancer.business_address}\n"
        body += f"\n📅 Add to your calendar: {calendar_url}\n"
        body += """
        

If you need to cancel or reschedule, please contact the freelancer directly.

– The SlotMe Team
"""

        try:
            send_branded_customer_reply(subject, body, user.email)
        except Exception as e:
            print("❌ Failed to send booking receipt:", e)

        return redirect(
            f"http://localhost:5173/booking-confirmed?appointment_id={appointment.id}"
        )
    else:
        return redirect("http://localhost:5173/not-found")


@app.route("/resend-confirmation/<int:appointment_id>", methods=["POST"])
def resend_confirmation_email(appointment_id):
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({"error": "Appointment not found"}), 404

    if appointment.status != "pending":
        return (
            jsonify({"error": "This appointment is already confirmed or cancelled."}),
            400,
        )

    user = appointment.user
    token = serializer.dumps({"appointment_id": appointment.id}, salt="booking-confirm")
    link = f"http://127.0.0.1:5000/confirm-booking/{token}"

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

    return jsonify({"message": "Confirmation email resent."}), 200


# GET /appointment/<int:appointment_id>
@app.route("/appointment/<int:appointment_id>")
def get_appointment(appointment_id):
    appt = Appointment.query.get(appointment_id)
    if not appt:
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
            "last_name": appt.user.last_name,
            "freelancer_name": appt.freelancer.business_name or "your freelancer",
            "day": appt.slot.day,
            "time": appt.slot.master_time.label,
            "timezone": "EST",
            "service_name": appt.service.name,
            "business_address": appt.freelancer.business_address or None,
            "calendar_url": calendar_url,
        }
    )


@app.route("/dev/cleanup-pending", methods=["POST"])
def cleanup_pending():
    ten_minutes_ago = datetime.utcnow() - timedelta(minutes=10)
    expired = Appointment.query.filter(
        Appointment.status == "pending", Appointment.timestamp < ten_minutes_ago
    ).all()

    for appt in expired:
        appt.status = "cancelled"
        appt.slot.is_booked = False  # Free up slot

    db.session.commit()
    return jsonify({"message": f"Expired {len(expired)} pending appointments."})


@app.route("/cancel-booking/<token>", methods=["GET"])
def cancel_booking(token):
    try:
        data = serializer.loads(token, salt="booking-confirm", max_age=86400)
        appointment_id = data["appointment_id"]
    except SignatureExpired:
        return redirect("http://localhost:5173/expired")
    except BadSignature:
        return redirect("http://localhost:5173/invalid")

    appt = Appointment.query.get(appointment_id)
    if not appt or appt.status != "pending":
        return redirect("http://localhost:5173/not-found")

    appt.status = "cancelled"
    appt.slot.is_booked = False
    db.session.commit()

    return redirect("http://localhost:5173/booking-cancelled")

@app.route("/download-ics/<int:appointment_id>")
def download_ics(appointment_id):
    appt = Appointment.query.get(appointment_id)
    if not appt:
        return jsonify({"error": "Not found"}), 404

    user = appt.user
    freelancer = appt.freelancer
    service = appt.service
    slot = appt.slot

    # Parse naive time assuming it's in Eastern Time (local UI-facing label)
    est = pytz.timezone("US/Eastern")
    naive_start = datetime.strptime(f"{slot.day} {slot.master_time.time_24h}", "%Y-%m-%d %H:%M")
    aware_start = est.localize(naive_start)

    # Convert to UTC
    utc_start = aware_start.astimezone(pytz.utc)
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


def purge_old_pending():
    with app.app_context():
        print("🧹 Running startup cleanup for expired pending bookings...")
        cutoff = datetime.utcnow() - timedelta(minutes=10)
        expired = Appointment.query.filter(
            Appointment.status == "pending", Appointment.timestamp < cutoff
        ).all()

        for appt in expired:
            appt.status = "cancelled"
            appt.slot.is_booked = False

        db.session.commit()
        print(f"✅ Cleaned {len(expired)} expired pending bookings.")


# Run once at startup
purge_old_pending()
# -----------------------
if __name__ == "__main__":
    app.run(debug=True)
