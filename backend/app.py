# This file is pretty much like a .app file in Express that holds all of our routes

from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, TimeSlot, Appointment
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Create the Flask app
app = Flask(__name__)
CORS(app)  # Allow requests from React (localhost:5173)

# Configure SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL", "sqlite:///scheduler.db")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy with the app
db.init_app(app)

# Run this once to create the tables (we'll add CLI commands later)
with app.app_context():
    db.create_all()

# Root test route
@app.route("/")
def index():
    return jsonify({"message": "Server is running!"})



# One-time route to seed the database with fake time slots
@app.route("/seed", methods=["POST"])
def seed_time_slots():
    if TimeSlot.query.first():  # If any time slot exists, skip
        return jsonify({"message": "Slots already seeded"}), 400

    sample_times = ["10:00 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM", "9:00 AM"]
    for t in sample_times:
        db.session.add(TimeSlot(time=t, is_booked=False))

    db.session.commit()
    return jsonify({"message": "Sample time slots added"})

# This will fetch all time slots from the database so your frontend can display them dynamically.
# Route to fetch all available time slots
@app.route("/slots", methods=["GET"])
def get_time_slots():
    slots = TimeSlot.query.all()
    result = []
    for slot in slots:
        result.append({
            "id": slot.id,
            "time": slot.time,
            "is_booked": slot.is_booked
        })
    return jsonify(result)

# Booking route: route that receives a POST request with a name, email, and slot ID, checks if the slot is free, books the appointment, and marks the slot as taken.
@app.route("/book", methods=["POST"])
def book_slot():
    data = request.get_json()

    # Grab data from the request
    name = data.get("name")
    email = data.get("email")
    slot_id = data.get("slot_id")

    # Basic validation
    if not name or not email or not slot_id:
        return jsonify({"error": "Missing required fields"}), 400

    # Check if slot exists and is available
    slot = TimeSlot.query.get(slot_id)
    if not slot or slot.is_booked:
        return jsonify({"error": "Slot is unavailable"}), 400

    # Create appointment and mark slot as booked
    appointment = Appointment(name=name, email=email, slot_id=slot_id)
    slot.is_booked = True

    db.session.add(appointment)
    db.session.commit()

    return jsonify({"message": "Appointment booked successfully!"}), 200

# GET: Appointment route which queries all Appointments from DB, pulls the name, email, and slot.time, then retusn them as a JSON list so frontend can display
@app.route("/appointments", methods=["GET"])
def get_appointments():
    appointments = Appointment.query.all()
    result = []

    for a in appointments:
        result.append({
            "id": a.id,
            "name": a.name,
            "email": a.email,
            "slot_time": a.slot.time  # Access related time from TimeSlot
        })

    return jsonify(result)

# Delete a booking/appointment and free up that slot
@app.route("/appointments/<int:id>", methods=["DELETE"])
def delete_appointment(id):
    appointment = Appointment.query.get(id)
    if not appointment:
        return jsonify({"error": "Appointment not found"}), 404

    # Free up the slot
    appointment.slot.is_booked = False
    db.session.delete(appointment)
    db.session.commit()

    return jsonify({"message": "Appointment cancelled"})

# Start the server LAST
if __name__ == "__main__":
    app.run(debug=True)
