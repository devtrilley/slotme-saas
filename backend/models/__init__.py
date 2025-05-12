from flask_sqlalchemy import SQLAlchemy

# This will be used to initialize and access the database across files
db = SQLAlchemy()

# This model represents available time slots in the system
class TimeSlot(db.Model):
    id = db.Column(db.Integer, primary_key=True)      # Unique ID
    time = db.Column(db.String(20), nullable=False)   # e.g., "10:00 AM"
    is_booked = db.Column(db.Boolean, default=False)  # Whether this time is taken

# This model represents a user's appointment (booking)
class Appointment(db.Model):
    id = db.Column(db.Integer, primary_key=True)            # Unique ID
    name = db.Column(db.String(100), nullable=False)        # User's name
    email = db.Column(db.String(120), nullable=False)       # User's email
    slot_id = db.Column(db.Integer, db.ForeignKey('time_slot.id'), nullable=False)  # Links to TimeSlot

    # Optional: Access the full slot object via `appointment.slot`
    slot = db.relationship('TimeSlot')