# This file is pretty much like a .app file in Express that holds all of our routes

from flask import Flask, request, jsonify, redirect
from flask import g
from flask_cors import CORS, cross_origin
from models import db, TimeSlot, Appointment, Freelancer, User, MasterTimeSlot, Service
from dotenv import load_dotenv
import re #Regular Expression
from werkzeug.security import check_password_hash  # At top with imports
from werkzeug.security import generate_password_hash
from itsdangerous import URLSafeTimedSerializer
from datetime import datetime, timedelta


import os
import secrets

load_dotenv()

app = Flask(__name__)
CORS(app,
     resources={r"/*": {"origins": "http://localhost:5173"}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "X-Freelancer-ID"])

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "sqlite:///scheduler.db")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()

serializer = URLSafeTimedSerializer(os.getenv("SECRET_KEY", "super-secret"))


# @app.before_request
# def load_freelancer():
#     if request.method == "OPTIONS":
#         return  # Let CORS preflight through

#     # Allow unauthenticated access to dev routes, login, seeding, and verify route
#     if (
#         request.path.startswith("/dev/")
#         or request.path.startswith("/auth")
#         or request.path.startswith("/seed")
#         or request.path.startswith("/verify")
#         or request.path.startswith("/master-times")
#     ):
#         return

#     freelancer_id = request.headers.get("X-Freelancer-ID", type=int)
#     if not freelancer_id:
#         return jsonify({"error": "Missing freelancer ID"}), 403
#     g.freelancer_id = freelancer_id
@app.before_request
def load_freelancer():
    if request.method == "OPTIONS":
        return

    open_prefixes = (
        "/dev/",
        "/auth",
        "/seed",
        "/verify",
        "/master-times",
    )

    # Allow all paths that match known open prefixes, OR start with /freelancers
    if any(request.path.startswith(prefix) for prefix in open_prefixes) or request.path.startswith("/freelancers"):
            return

    freelancer_id = request.headers.get("X-Freelancer-ID", type=int)
    if not freelancer_id:
        return jsonify({"error": "Missing freelancer ID"}), 403

    g.freelancer_id = freelancer_id

@app.route("/")
def index():
    return jsonify({"message": "Server is running!"})

@app.route("/slots", methods=["GET"])
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
        service_id=service_id
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
            "confirmed": a.confirmed,
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

# Testing route with full info. Use over old /seeds route
from datetime import datetime, timedelta

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
        twitter_url="https://twitter.com/elonmusk"
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
        twitter_url="https://twitter.com/elonmusk"
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
    auth = request.headers.get("X-Dev-Auth")
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

    auth = request.headers.get("X-Dev-Auth")
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

    auth = request.headers.get("X-Dev-Auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    return jsonify({
        "id": freelancer.id,
        "name": freelancer.name,
        "email": freelancer.email,  # ✅ add this
        "phone": freelancer.phone,  # ✅ add this
        "logo_url": freelancer.logo_url,
        "tagline": freelancer.tagline,
        "bio": freelancer.bio,
        "instagram_url": freelancer.instagram_url,  # ✅ add this
        "twitter_url": freelancer.twitter_url,      # ✅ add this
        "is_verified": freelancer.is_verified,
        "joined": freelancer.id,  # Replace with created_at if you add it later
        "services": service_data
})

@app.route("/dev/appointments/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_dev_appointments_for_freelancer(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200  # ✅ Allow CORS preflight

    auth = request.headers.get("X-Dev-Auth")
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
            "slot_time": a.slot.master_time.label,  # ✅ FIXED: use master_time.label
            "confirmed": a.confirmed,
        })

    return jsonify(result)

@app.route("/dev/freelancers", methods=["POST"])
def create_freelancer():
    auth = request.headers.get("X-Dev-Auth")
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

    auth = request.headers.get("X-Dev-Auth")
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
        "no_show_policy": getattr(freelancer, "no_show_policy", "")
    })

@app.route("/freelancer/branding", methods=["PATCH"])
def update_freelancer_branding():
    freelancer_id = g.freelancer_id
    data = request.get_json()
    freelancer = Freelancer.query.get(freelancer_id)

    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    # ✅ Now includes name
    freelancer.name = data.get("name", freelancer.name)
    freelancer.logo_url = data.get("logo_url", freelancer.logo_url)
    freelancer.bio = data.get("bio", freelancer.bio)
    freelancer.tagline = data.get("tagline", freelancer.tagline)
    freelancer.timezone = data.get("timezone", freelancer.timezone)
    freelancer.no_show_policy = data.get("no_show_policy", freelancer.no_show_policy)

    db.session.commit()
    return jsonify({"message": "Branding updated"})

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

    appt.confirmed = True
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
        "email": freelancer.contact_email,  # <-- This one if you're using a separate public email
        "phone": freelancer.phone,
        "instagram_url": freelancer.instagram_url,
        "twitter_url": freelancer.twitter_url,
        "is_verified": freelancer.is_verified,
        "joined": freelancer.id,
        "services": service_data
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
# -----------------------
if __name__ == "__main__":
    app.run(debug=True)