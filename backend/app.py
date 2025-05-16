# This file is pretty much like a .app file in Express that holds all of our routes

from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, TimeSlot, Appointment, Client
from dotenv import load_dotenv
from werkzeug.security import check_password_hash  # At top with imports
from werkzeug.security import generate_password_hash
import os

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "sqlite:///scheduler.db")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()

@app.route("/")
def index():
    return jsonify({"message": "Server is running!"})

# @app.route("/seed", methods=["POST"])
# def seed_time_slots():
#     client_id = 1  # 🔧 temporary hardcoded client for dev
#     if TimeSlot.query.filter_by(client_id=client_id).first():
#         return jsonify({"message": "Slots already seeded"}), 400

#     sample_times = ["10:00 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM", "9:00 AM"]
#     for t in sample_times:
#         db.session.add(TimeSlot(time=t, is_booked=False, client_id=client_id))

#     db.session.commit()
#     return jsonify({"message": "Sample time slots added"})

@app.route("/slots", methods=["GET"])
def get_time_slots():
    client_id = 1
    slots = TimeSlot.query.filter_by(client_id=client_id).all()
    result = []

    for slot in slots:
        slot_data = {
            "id": slot.id,
            "time": slot.time,
            "is_booked": slot.is_booked,
        }

        if slot.is_booked and slot.appointment:
            slot_data["appointment"] = {
                "name": slot.appointment.name,
                "email": slot.appointment.email
            }

        result.append(slot_data)

    return jsonify(result)

@app.route("/book", methods=["POST"])
def book_slot():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    slot_id = data.get("slot_id")

    if not name or not email or not slot_id:
        return jsonify({"error": "Missing required fields"}), 400

    if Appointment.query.filter_by(email=email).first():
        return jsonify({"error": "Email already has an appointment."}), 400

    slot = TimeSlot.query.get(slot_id)
    if not slot or slot.is_booked:
        return jsonify({"error": "Slot is unavailable"}), 400

    appointment = Appointment(
        name=name,
        email=email,
        slot_id=slot_id,
        client_id=slot.client_id  # ✅ inherit ownership
    )
    slot.is_booked = True

    db.session.add(appointment)
    db.session.commit()

    return jsonify({"message": "Appointment booked successfully!"}), 200

@app.route("/appointments", methods=["GET"])
def get_appointments():
    client_id = 1
    appointments = Appointment.query.filter_by(client_id=client_id).all()
    result = []

    for a in appointments:
        result.append({
            "id": a.id,
            "name": a.name,
            "email": a.email,
            "slot_time": a.slot.time
        })

    return jsonify(result)

@app.route("/appointments/<int:id>", methods=["DELETE"])
def delete_appointment(id):
    client_id = 1
    appointment = Appointment.query.get(id)
    if not appointment or appointment.client_id != client_id:
        return jsonify({"error": "Appointment not found or unauthorized"}), 404

    appointment.slot.is_booked = False
    db.session.delete(appointment)
    db.session.commit()
    return jsonify({"message": "Appointment cancelled"})

@app.route("/appointments/<int:id>", methods=["PATCH"])
def update_appointment(id):
    client_id = 1
    data = request.get_json()
    new_slot_id = data.get("slot_id")

    if not new_slot_id:
        return jsonify({"error": "Missing slot_id"}), 400

    appointment = Appointment.query.get(id)
    if not appointment or appointment.client_id != client_id:
        return jsonify({"error": "Appointment not found or unauthorized"}), 404

    new_slot = TimeSlot.query.get(new_slot_id)
    if not new_slot or new_slot.client_id != client_id:
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
@app.route("/seed-full", methods=["POST"])
def seed_with_client():
    if Client.query.first():
        return jsonify({"message": "Already seeded"}), 400

    # 1. Create a client
    client = Client(name="Demo Client", email="demo@mail.com", password=generate_password_hash("demo123"))
    db.session.add(client)
    db.session.commit()

    # 2. Create sample time slots for that client
    sample_times = ["9:00 AM", "10:00 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"]
    for time in sample_times:
        slot = TimeSlot(time=time, client_id=client.id)
        db.session.add(slot)

    db.session.commit()
    return jsonify({"message": "Seeded demo client and slots!"})

@app.route("/client-login", methods=["POST"])
def client_login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    client = Client.query.filter_by(email=email).first()
    if not client or not check_password_hash(client.password, password):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"client_id": client.id}), 200

if __name__ == "__main__":
    app.run(debug=True)