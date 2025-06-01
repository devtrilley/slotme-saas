# This file is pretty much like a .app file in Express that holds all of our routes

from flask import Flask, request, jsonify, redirect
from flask import g
from flask_cors import CORS, cross_origin
from models import db, TimeSlot, Appointment, Freelancer, User, MasterTimeSlot, Service
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re #Regular Expression
from werkzeug.security import check_password_hash  # At top with imports
from werkzeug.security import generate_password_hash
from itsdangerous import URLSafeTimedSerializer
from datetime import datetime, timedelta

from email_utils import send_support_email
from email_utils import send_reply_email


import os
import secrets

load_dotenv()

app = Flask(__name__)
CORS(app,
     resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "X-Freelancer-ID", "X-Dev-Auth"])

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "sqlite:///scheduler.db")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

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

@app.before_request
def load_freelancer():
    print("🔥 Path:", request.path)
    print("🔥 Headers:", dict(request.headers))

    if request.method == "OPTIONS":
        return

    open_prefixes = ("/dev", "/auth", "/seed", "/verify", "/master-times", "/404")

    # ✅ Check if the route exists in Flask OR it's a known public custom_url
    if (
        any(request.path.startswith(prefix) for prefix in open_prefixes)
        or request.path.startswith("/freelancers")
        or request.endpoint == "public_profile_by_url"
        or is_valid_public_slug(request.path)
        or request.path == "/404"
    ):
        print("✅ Skipping auth for open or public path.")
        return

    # ❌ Block unauthorized access to protected routes
    freelancer_id = request.headers.get("X-Freelancer-ID", type=int)
    if not freelancer_id:
        print("❌ Missing freelancer ID")
        return jsonify({"error": "Missing freelancer ID"}), 403

    g.freelancer_id = freelancer_id
    print("✅ Authenticated as freelancer:", g.freelancer_id)

@app.route("/")
def index():
    return jsonify({"message": "Server is running!"})

@app.route("/slots", methods=["GET"])
@cross_origin(origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_headers=["X-Freelancer-ID"])
def get_time_slots():
    freelancer_id = g.freelancer_id
    slots = TimeSlot.query.filter_by(freelancer_id=freelancer_id).all()
    result = []

    for slot in slots:
        slot_data = {
            "id": slot.id,
            "time": slot.master_time.label,  # ✅ Use label from master_time
            "day": slot.day,  # Add this line
            "is_booked": slot.is_booked,
        }

        if slot.is_booked and slot.appointment and slot.appointment.user:
            slot_data["appointment"] = {
                "name": slot.appointment.user.name,
                "email": slot.appointment.user.email
            }

        result.append(slot_data)

    return jsonify(result)

@app.route("/book", methods=["POST"])
def book_slot():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone")  # New
    slot_id = data.get("slot_id")

    if not name or not email or not slot_id:
        return jsonify({"error": "Missing required fields"}), 400

    # Get and validate slot
    slot = TimeSlot.query.get(slot_id)
    if not slot or slot.is_booked:
        return jsonify({"error": "Slot is unavailable"}), 400

    # Check or create user
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(name=name, email=email, phone=phone)
        db.session.add(user)
        db.session.commit()

    # Check for duplicate appointment by user + slot
    existing_appt = Appointment.query.filter_by(user_id=user.id, slot_id=slot_id).first()
    if existing_appt:
        return jsonify({"error": "You already booked this slot."}), 400

    service_id = data.get("service_id")

    # Create appointment
    appointment = Appointment(
        slot_id=slot_id,
        freelancer_id=slot.freelancer_id,
        user_id=user.id,
        service_id=service_id,
        status='pending'  # 👈 or 'confirmed' if you’re skipping email flow
    )
    slot.is_booked = True

    db.session.add(appointment)
    db.session.commit()

    token = serializer.dumps({"appointment_id": appointment.id})
    link = f"http://localhost:5000/verify/{token}"

    print(f"📧 Send this to the user: {link}")

    return jsonify({"message": "Verification email sent."}), 200

@app.route("/appointments", methods=["GET"])
def get_appointments():
    freelancer_id = g.freelancer_id
    freelancer = Freelancer.query.get(freelancer_id)
    appointments = Appointment.query.filter_by(freelancer_id=freelancer_id).all()
    result = []

    for a in appointments:
        result.append({
            "id": a.id,
            "name": a.user.name if a.user else None,
            "email": a.user.email if a.user else None,
            "slot_day": a.slot.day,
            "slot_time": a.slot.master_time.label,
            "status": a.status,
            "freelancer_timezone": freelancer.timezone
        })

    return jsonify(result)

@app.route("/appointments/<int:id>", methods=["DELETE"])
def delete_appointment(id):
    freelancer_id = g.freelancer_id
    appointment = Appointment.query.get(id)
    if not appointment or appointment.freelancer_id != freelancer_id:
        return jsonify({"error": "Appointment not found or unauthorized"}), 404

    appointment.slot.is_booked = False
    db.session.delete(appointment)
    db.session.commit()
    return jsonify({"message": "Appointment cancelled"})

@app.route("/appointments/<int:id>", methods=["PATCH"])
def update_appointment(id):
    freelancer_id = g.freelancer_id
    data = request.get_json()
    new_slot_id = data.get("slot_id")

    if not new_slot_id:
        return jsonify({"error": "Missing slot_id"}), 400

    appointment = Appointment.query.get(id)
    if not appointment or appointment.freelancer_id != freelancer_id:
        return jsonify({"error": "Appointment not found or unauthorized"}), 404

    new_slot = TimeSlot.query.get(new_slot_id)
    if not new_slot or new_slot.freelancer_id != freelancer_id:
        return jsonify({"error": "Invalid new slot"}), 404

    if new_slot.is_booked:
        return jsonify({"error": "Time slot is already booked"}), 400

    old_slot = appointment.slot
    old_slot.is_booked = False
    appointment.slot_id = new_slot_id
    new_slot.is_booked = True

    db.session.commit()
    return jsonify({"message": "Appointment updated successfully!"})

@app.route("/seed-full", methods=["POST", "OPTIONS"])
def seed_with_freelancer():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    if Freelancer.query.first():
        return jsonify({"message": "Already seeded"}), 400

    freelancer = Freelancer(
        name="Amber's Love Cafe",
        email="demo@mail.com",
        password=generate_password_hash("demo123"),
        logo_url="https://randomuser.me/api/portraits/women/45.jpg",
        tagline='Let\'s grab "Hot Coffee". Night bookings only...',
        bio="Currently in Charlotte, NC! Been working all my life. Experience in: Miami, Toronto, and Vegas",
        is_verified=True,
        phone="555-123-4567",
        contact_email="booking@ambercafe.com",
        instagram_url="https://instagram.com/zuck",
        twitter_url="https://twitter.com/elonmusk",
        no_show_policy="Please cancel at least 24 hours in advance.",
        faq_text="• $10 deposit required.\n• Please arrive 10 minutes early.\n• No-shows forfeit deposit."
    )
    db.session.add(freelancer)
    db.session.commit()

    today = datetime.now().date()
    labels = ["09:00 AM", "09:15 AM", "09:30 AM", "10:00 AM", "10:15 AM", "10:30 AM"]
    for label in labels:
        master_time = MasterTimeSlot.query.filter_by(label=label).first()
        if master_time:
            db.session.add(TimeSlot(
                day=today.isoformat(),
                master_time_id=master_time.id,
                freelancer_id=freelancer.id
            ))

    services = [
        Service(
            freelancer_id=freelancer.id,
            name="Café au Lay",
            description="A sensual coffee-making experience with full-body contact.",
            duration_minutes=45,
            price_usd=50.00
        ),
        Service(
            freelancer_id=freelancer.id,
            name="Espresso Eiffel Tower",
            description="Perfect for threesomes. Short, strong, and unforgettable.",
            duration_minutes=30,
            price_usd=70.00
        )
    ]
    db.session.add_all(services)
    db.session.commit()

    return jsonify({"message": "Seeded demo freelancer with full branding, slots, and services."})

@app.route("/seed-freelancer2", methods=["POST", "OPTIONS"])
def seed_second_freelancer():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    if Freelancer.query.count() >= 2:
        return jsonify({"message": "Second freelancer already seeded"}), 400

    freelancer = Freelancer(
        name="Ping's Slippery Massage",
        email="night@mail.com",
        password=generate_password_hash("night123"),
        logo_url="https://randomuser.me/api/portraits/women/32.jpg",
        tagline="I milk you, we have fun time!",
        bio="Trained in Bangkok. Open late. Ask about group sessions and 5-hand discounts.",
        is_verified=True,
        phone="555-987-6543",
        contact_email="contact@pingmassage.com",
        instagram_url="https://instagram.com/zuck",
        twitter_url="https://twitter.com/elonmusk",
        no_show_policy="Reschedule at least 12 hours ahead to avoid penalty.",
        faq_text="• Bridal trials available by request.\n• Travel fees apply for out-of-salon events.",
        tier="elite",  # ✅ Make sure support works
    )
    db.session.add(freelancer)
    db.session.commit()

    tomorrow = datetime.now().date() + timedelta(days=1)
    labels = ["06:30 PM", "06:45 PM", "07:00 PM", "07:15 PM"]
    for label in labels:
        master_time = MasterTimeSlot.query.filter_by(label=label).first()
        if master_time:
            db.session.add(TimeSlot(
                day=tomorrow.isoformat(),
                master_time_id=master_time.id,
                freelancer_id=freelancer.id
            ))

    services = [
        Service(
            freelancer_id=freelancer.id,
            name="Happy Ending Herbal Rubdown",
            description="Start stiff, leave smiling. Our most booked treatment.",
            duration_minutes=60,
            price_usd=79.99
        ),
        Service(
            freelancer_id=freelancer.id,
            name="Thai Five-Hand Combo",
            description="A once-in-a-lifetime experience. Two-hour escape.",
            duration_minutes=120,
            price_usd=149.99
        )
    ]
    db.session.add_all(services)
    db.session.commit()

    return jsonify({"message": "Seeded second freelancer with full branding, slots, and services."})

@app.route("/auth", methods=["POST"])
def freelancer_login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer or not check_password_hash(freelancer.password, password):
        return jsonify({"error": "Invalid login"}), 401

    return jsonify({"freelancer_id": freelancer.id}), 200

@app.route("/dev/freelancers", methods=["GET"])
def get_all_freelancers():
    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancers = Freelancer.query.all()
    result = []
    for c in freelancers:
        result.append({
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "logo_url": c.logo_url,
            "tagline": c.tagline,
            "bio": c.bio,
            "is_verified": c.is_verified
        })
    return jsonify(result)

@app.route("/dev/slots/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_freelancer_slots(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200  # ✅ Allow CORS preflight

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    slots = TimeSlot.query.filter_by(freelancer_id=freelancer_id).all()
    result = []
    for slot in slots:
        data = {
            "id": slot.id,
            "time": slot.master_time.label,   # ✅ FIXED: Use master_time.label
            "day": slot.day,
            "is_booked": slot.is_booked
        }

        if slot.is_booked and slot.appointment and slot.appointment.user:
            data["appointment"] = {
                "name": slot.appointment.user.name,
                "email": slot.appointment.user.email
            }

        result.append(data)

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

    return jsonify({
        "id": freelancer.id,
        "name": freelancer.name,
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
    })

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
        result.append({
            "id": a.id,
            "name": a.user.name if a.user else None,
            "email": a.user.email if a.user else None,
            "slot_day": a.slot.day,
            "slot_time": a.slot.master_time.label, # ✅ FIXED: use master_time.label
            "status": a.status,
        })

    return jsonify(result)

@app.route("/dev/freelancers", methods=["POST"])
def create_freelancer():
    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    if Freelancer.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    new_freelancer = Freelancer(
        name=name,
        email=email,
        password=generate_password_hash(password)
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

@app.route("/freelancer-info", methods=["GET"])
def get_freelancer_info():
    freelancer_id = request.headers.get("X-Freelancer-ID", type=int)
    if not freelancer_id:
        return jsonify({"error": "Missing freelancer ID"}), 403

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    return jsonify({
        "name": freelancer.name,
        "logo_url": getattr(freelancer, "logo_url", None),
        "tagline": getattr(freelancer, "tagline", ""),
        "bio": getattr(freelancer, "bio", ""),
        "timezone": getattr(freelancer, "timezone", "America/New_York"),
        "is_verified": freelancer.is_verified,  # ✅ Include this
        "no_show_policy": getattr(freelancer, "no_show_policy", ""),
        "faq_text": freelancer.faq_text,
    })

@app.route("/slots", methods=["POST"])
def create_time_slot():
    freelancer_id = g.freelancer_id
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
        freelancer_id=freelancer_id,
        day=day,
        master_time_id=master_time_id
    ).first()

    if existing:
        return jsonify({"error": "Time slot already exists"}), 400

    # Optionally update freelancer's timezone if provided
    timezone = data.get("timezone")
    if timezone:
        freelancer = Freelancer.query.get(freelancer_id)
        if freelancer:
            freelancer.timezone = timezone
            db.session.commit()

    slot = TimeSlot(
        day=day,
        master_time_id=master_time_id,
        freelancer_id=freelancer_id
    )
    db.session.add(slot)
    db.session.commit()

    return jsonify({"message": "Time slot created", "slot_id": slot.id}), 201

@app.route("/slots/<int:slot_id>", methods=["DELETE"])
def delete_time_slot(slot_id):
    freelancer_id = g.freelancer_id
    slot = TimeSlot.query.get(slot_id)

    if not slot or slot.freelancer_id != freelancer_id:
        return jsonify({"error": "Slot not found or unauthorized"}), 404

    if slot.is_booked:
        return jsonify({"error": "Cannot delete a booked slot"}), 400

    db.session.delete(slot)
    db.session.commit()
    return jsonify({"message": "Slot deleted"}), 200

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

    appt.status = 'confirmed'
    db.session.commit()
    return redirect("http://localhost:5173/thank-you")  # Adjust if hosted

@app.route("/seed/master-times", methods=["POST"])
def seed_master_time_slots():
    from models import MasterTimeSlot  # ✅ Local import works inside route

    db.session.query(MasterTimeSlot).delete()

    start_time = datetime.strptime("00:00", "%H:%M")
    delta = timedelta(minutes=15)

    for i in range(96):
        time_24h = (start_time + i * delta).strftime("%H:%M")            
        label = (start_time + i * delta).strftime("%I:%M %p")           
        db.session.add(MasterTimeSlot(time_24h=time_24h, label=label))

    db.session.commit()
    return jsonify({"message": "✅ 96 master time slots seeded."}), 200


@app.route("/master-times", methods=["GET"])
def get_master_time_slots():
    from models import MasterTimeSlot

    times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    result = [
        {"id": t.id, "label": t.label, "time_24h": t.time_24h}
        for t in times
    ]
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
        for s in services if s.is_enabled
    ]

    return jsonify({
        "id": freelancer.id,
        "name": freelancer.name,
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
    })

@app.route("/freelancer/services", methods=["GET", "OPTIONS"])
@cross_origin(origins="http://localhost:5173", headers=["Content-Type", "Authorization", "X-Freelancer-ID"])
def get_services():
    if request.method == "OPTIONS":
        return '', 200

    freelancer_id = request.headers.get("X-Freelancer-ID", type=int)
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
            "is_enabled": s.is_enabled
        }
        for s in services
    ]
    return jsonify(result)

@app.route('/freelancer/services', methods=['POST', 'OPTIONS'])
@cross_origin(origins="http://localhost:5173", headers=["Content-Type", "Authorization", "X-Freelancer-ID"])
def add_service():
    if request.method == "OPTIONS":
        return '', 200

    freelancer_id = request.headers.get("X-Freelancer-ID", type=int)
    if not freelancer_id:
        return jsonify({"error": "Missing freelancer ID"}), 403

    data = request.get_json()
    name = data.get("name")
    description = data.get("description", "")
    duration_minutes = data.get("duration_minutes")
    price_usd = data.get("price_usd")

    if not name or not duration_minutes:
        return jsonify({"error": "Missing required fields"}), 400

    service = Service(
        freelancer_id=freelancer_id,
        name=name,
        description=description,
        duration_minutes=duration_minutes,
        price_usd=price_usd
    )
    db.session.add(service)
    db.session.commit()
    return jsonify({"message": "Service added!"}), 201

@app.route('/freelancer/services/<int:service_id>', methods=['DELETE', 'OPTIONS'])
@cross_origin(origins="http://localhost:5173", headers=["Content-Type", "Authorization", "X-Freelancer-ID"])
def delete_service(service_id):
    if request.method == "OPTIONS":
        return '', 200

    service = Service.query.get(service_id)
    db.session.delete(service)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@app.route('/freelancer/services/<int:service_id>', methods=['PATCH', 'OPTIONS'])
@cross_origin(origins="http://localhost:5173", headers=["Content-Type", "Authorization", "X-Freelancer-ID"])
def update_service(service_id):
    if request.method == "OPTIONS":
        return '', 200

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
def get_analytics():
    freelancer_id = g.freelancer_id
    from sqlalchemy import func

    # Count totals by status
    total = Appointment.query.filter(
        Appointment.freelancer_id == freelancer_id,
        Appointment.status != 'cancelled'
    ).count()
    confirmed = Appointment.query.filter_by(freelancer_id=freelancer_id, status='confirmed').count()
    cancelled = Appointment.query.filter_by(freelancer_id=freelancer_id, status='cancelled').count()

    # Top service
    # Returns all tied top services
    top_services = (
        db.session.query(Service.name, func.count(Appointment.id).label("count"))
        .join(Appointment, Service.id == Appointment.service_id)
        .filter(Service.freelancer_id == freelancer_id)
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
        .filter(Service.freelancer_id == freelancer_id)
        .group_by(Service.name)
        .all()
    )
    service_chart_data = [{"id": name, "value": count} for name, count in service_counts]

    # Line chart: booking trend by scheduled day (regardless of status)
    trend_counts = (
        db.session.query(TimeSlot.day, func.count(Appointment.id))
        .join(TimeSlot, Appointment.slot_id == TimeSlot.id)
        .filter(Appointment.freelancer_id == freelancer_id, Appointment.status != 'cancelled')
        .group_by(TimeSlot.day)
        .order_by(TimeSlot.day)
        .all()
    )
    trend_data = [{"x": day, "y": count} for day, count in trend_counts]

    # Bar chart: revenue per service (only confirmed)
    revenue_per_service = (
        db.session.query(Service.name, func.sum(Service.price_usd))
        .join(Appointment, Service.id == Appointment.service_id)
        .filter(Appointment.freelancer_id == freelancer_id, Appointment.status != "cancelled")
        .group_by(Service.name)
        .all()
    )
    revenue_chart_data = [{"service": name, "revenue": round(revenue or 0, 2)} for name, revenue in revenue_per_service]

    return jsonify({
        "total_bookings": total,
        "confirmed": confirmed,
        "cancelled": cancelled,
        "top_service": ", ".join(top_names) if top_names else None,
        "bookings_per_service": service_chart_data,
        "booking_trend": trend_data,
        "service_revenue": revenue_chart_data,
        "signup_date": Freelancer.query.get(freelancer_id).created_at.strftime("%-m/%-d/%y")
    })

@app.route("/dev/seed-demo-history", methods=["POST"])
def seed_demo_history():
    print("🔥 Hit /dev/seed-demo-history")
    print("🔥 Headers:", dict(request.headers))

    auth = request.headers.get("X-Dev-Auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancer_id = request.headers.get("X-Freelancer-ID", type=int)
    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 400

    services = Service.query.filter_by(freelancer_id=freelancer.id).all()
    if not services:
        return jsonify({"error": "Seed services first"}), 400

    from random import choice

    labels = ["09:00 AM", "09:15 AM", "09:30 AM", "10:00 AM", "10:15 AM", "10:30 AM"]
    
    # Define 5 dates and how many bookings on each
    bookings_by_day = {
        (datetime.now().date() + timedelta(days=i)).isoformat(): count
        for i, count in enumerate([1, 2, 3, 3, 3])  # total = 12
    }

    for day_str, count in bookings_by_day.items():
        label_cycle = (label for label in labels * 2)

        for i in range(count):
            label = next(label_cycle)
            master_time = MasterTimeSlot.query.filter_by(label=label).first()
            if not master_time:
                continue

            slot = TimeSlot(
                day=day_str,
                freelancer_id=freelancer.id,
                master_time_id=master_time.id,
                is_booked=True
            )
            db.session.add(slot)
            db.session.commit()

            name = f"user_{day_str.replace('-', '')}_{i}"
            email = f"{name}@mail.com"
            user = User(name=name, email=email)
            db.session.add(user)
            db.session.commit()

            appt = Appointment(
                freelancer_id=freelancer.id,
                user_id=user.id,
                slot_id=slot.id,
                status="confirmed",
                service_id=choice(services).id,
                timestamp=datetime.now()  # Doesn't affect trend data
            )
            db.session.add(appt)

    db.session.commit()
    print(f"🌱 Seeded {freelancer.name}'s demo slots and bookings.")

    return jsonify({"message": "Seeded demo slots and bookings."}), 200

@app.route("/freelancer/support", methods=["POST"])
def send_support_request():
    freelancer_id = g.freelancer_id
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
        msg["Subject"] = f"[SlotMe Support] {subject}"

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
def reply_to_customer():
    freelancer_id = g.freelancer_id
    data = request.get_json()
    customer_email = data.get("to")
    subject = data.get("subject", "Reply from SlotMe Support")
    message = data.get("message", "")

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer or freelancer.tier != "elite":
        return jsonify({"error": "Unauthorized"}), 403

    try:
        send_reply_email(subject, message, customer_email)
        return jsonify({"message": "Reply sent successfully!"}), 200
    except Exception as e:
        print("❌ Reply failed:", str(e))
        return jsonify({"error": "Failed to send reply"}), 500
    
@app.route("/<string:custom_url>", methods=["GET"])
def public_profile_by_url(custom_url):
    # 👇 Prevent conflict with real routes like /404
    reserved_routes = {"404", "slots", "book", "auth", "seed", "verify", "master-times", "freelancer", "freelancers", "dev"}

    if custom_url in reserved_routes:
        return handle_404(None)

    freelancer = Freelancer.query.filter_by(custom_url=custom_url).first()
    if not freelancer:
        return handle_404(None)

    services = Service.query.filter_by(freelancer_id=freelancer.id, is_enabled=True).all()
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

    return jsonify({
        "id": freelancer.id,
        "name": freelancer.name,
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
    })

@app.route("/freelancer/branding", methods=["PATCH"])
def update_freelancer_branding():
    freelancer_id = g.freelancer_id
    data = request.get_json()
    freelancer = Freelancer.query.get(freelancer_id)

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    freelancer.name = data.get("name", freelancer.name)
    freelancer.logo_url = data.get("logo_url", freelancer.logo_url)
    freelancer.bio = data.get("bio", freelancer.bio)
    freelancer.tagline = data.get("tagline", freelancer.tagline)
    freelancer.timezone = data.get("timezone", freelancer.timezone)
    freelancer.no_show_policy = data.get("no_show_policy", freelancer.no_show_policy)
    freelancer.faq_text = data.get("faq_text", freelancer.faq_text)

    # ✅ Handle custom URL update
    if "custom_url" in data:
        new_url = data["custom_url"].strip().lower()

        if not re.match(r"^[a-z0-9_-]{3,30}$", new_url):
            return jsonify({"error": "Custom URL must be 3-30 characters, letters/numbers/dashes only."}), 400

        if Freelancer.query.filter(Freelancer.custom_url == new_url, Freelancer.id != freelancer.id).first():
            return jsonify({"error": "Custom URL is already taken."}), 400

        freelancer.custom_url = new_url

    db.session.commit()
    return jsonify({"message": "Branding updated"})

@app.errorhandler(404)
def handle_404(e):
    origin = request.headers.get("Origin", "*")
    response = jsonify({"error": "Not found"})
    response.status_code = 404
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Freelancer-ID, X-Dev-Auth"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    return response

@app.route("/404")
def hardcoded_404():
    return jsonify({"error": "Not found"}), 404
# -----------------------
if __name__ == "__main__":
    app.run(debug=True)