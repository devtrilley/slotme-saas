# This file is pretty much like a .app file in Express that holds all of our routes

from flask import Flask, request, jsonify
from flask import g
from flask_cors import CORS
from models import db, TimeSlot, Appointment, Freelancer, User, MasterTimeSlot
from dotenv import load_dotenv
import re #Regular Expression
from werkzeug.security import check_password_hash  # At top with imports
from werkzeug.security import generate_password_hash
from itsdangerous import URLSafeTimedSerializer


import os
import secrets

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

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

    open_routes = (
        "/dev/",
        "/auth",
        "/seed",
        "/verify",
        "/master-times"
    )

    if any(request.path.startswith(prefix) for prefix in open_routes):
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
            "time": slot.master_time.label,
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

    # Create appointment
    appointment = Appointment(
        slot_id=slot_id,
        freelancer_id=slot.freelancer_id,
        user_id=user.id,
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
        name="Demo Freelancer",
        email="demo@mail.com",
        password=generate_password_hash("demo123")
    )
    db.session.add(freelancer)
    db.session.commit()

    # Manually assign 6 slots
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

    db.session.commit()
    return jsonify({"message": "Seeded demo freelancer with 6 slots."})

@app.route("/seed-freelancer2", methods=["POST", "OPTIONS"])
def seed_second_freelancer():
    if request.method == "OPTIONS":
        return jsonify({}), 200

    if Freelancer.query.count() >= 2:
        return jsonify({"message": "Second freelancer already seeded"}), 400

    freelancer = Freelancer(
        name="Night Owl Freelancer",
        email="night@mail.com",
        password=generate_password_hash("night123")
    )
    db.session.add(freelancer)
    db.session.commit()

    # Manually assign 4 night slots
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

    db.session.commit()
    return jsonify({"message": "Second freelancer with 4 slots seeded."})

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
            "email": c.email
        })
    return jsonify(result)

@app.route("/dev/slots/<int:freelancer_id>", methods=["GET"])
def get_freelancer_slots(freelancer_id):
    auth = request.headers.get("X-Dev-Auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    slots = TimeSlot.query.filter_by(freelancer_id=freelancer_id).all()
    result = []
    for slot in slots:
        data = {
            "id": slot.id,
            "time": slot.time,
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
        "email": freelancer.email
    })

@app.route("/dev/appointments/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_dev_appointments_for_freelancer(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

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
            "slot_time": a.slot.time
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
        "logo_url": getattr(freelancer, "logo_url", None),  # future use
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

# -----------------------
if __name__ == "__main__":
    app.run(debug=True)