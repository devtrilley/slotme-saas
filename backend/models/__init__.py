from flask_sqlalchemy import SQLAlchemy
from datetime import datetime


db = SQLAlchemy()

class Freelancer(db.Model):
    __tablename__ = 'freelancers'

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    business_name = db.Column(db.String(150), nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    logo_url = db.Column(db.String(300), nullable=True)
    bio = db.Column(db.String(500), nullable=True)
    tagline = db.Column(db.String(200), nullable=True)
    timezone = db.Column(db.String(50), default="America/New_York")  # Default to EST
    is_verified = db.Column(db.Boolean, default=False)
    no_show_policy = db.Column(db.Text, nullable=True)
    faq_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    early_access = db.Column(db.Boolean, default=False)
    email_confirmed = db.Column(db.Boolean, default=False)
    confirmation_token = db.Column(db.String(128), nullable=True)

    # ✅ Tier field added here
    tier = db.Column(db.String(20), default="free")  # "free", "pro", "elite"

    custom_url = db.Column(db.String(50), unique=True, nullable=True)

    # ✅ New contact fields
    contact_email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    instagram_url = db.Column(db.String(200), nullable=True)
    twitter_url = db.Column(db.String(200), nullable=True)

    business_address = db.Column(db.String(300), nullable=True)  # ✅ Optional business address

    slots = db.relationship('TimeSlot', backref='freelancer', lazy=True)
    appointments = db.relationship('Appointment', backref='freelancer', lazy=True)

class User(db.Model):  # Customer
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=True)

    appointments = db.relationship('Appointment', backref='user', lazy=True)


class MasterTimeSlot(db.Model):
    __tablename__ = 'master_time_slots'

    id = db.Column(db.Integer, primary_key=True)
    time_24h = db.Column(db.String(5), nullable=False, unique=True)  # e.g., "13:15"
    label = db.Column(db.String(10), nullable=False)                 # e.g., "1:15 PM"

    slots = db.relationship('TimeSlot', back_populates='master_time')


class TimeSlot(db.Model):
    __tablename__ = 'time_slots'

    id = db.Column(db.Integer, primary_key=True)
    freelancer_id = db.Column(db.Integer, db.ForeignKey('freelancers.id'), nullable=False)
    day = db.Column(db.String(10), nullable=False)  # format: "YYYY-MM-DD"
    master_time_id = db.Column(db.Integer, db.ForeignKey('master_time_slots.id'), nullable=False)
    is_booked = db.Column(db.Boolean, default=False)

    master_time = db.relationship('MasterTimeSlot', back_populates='slots')
    appointment = db.relationship(
        'Appointment',
        back_populates='slot',
        uselist=False
    )


class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    freelancer_id = db.Column(db.Integer, db.ForeignKey('freelancers.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey('time_slots.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    email = db.Column(db.String(120))  # optional at first
    phone = db.Column(db.String(20))   # optional at first

    # ⬇️ New status field replaces need for confirmed/cancelled booleans
    status = db.Column(db.String(20), default='pending')  # 'pending', 'confirmed', 'cancelled'

    confirmation_token = db.Column(db.String(64), unique=True, nullable=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=True)

    slot = db.relationship(
        'TimeSlot',
        back_populates='appointment'
    )

    service = db.relationship('Service')

class Service(db.Model):
    __tablename__ = 'services'

    id = db.Column(db.Integer, primary_key=True)
    freelancer_id = db.Column(db.Integer, db.ForeignKey('freelancers.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300), nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=False)
    price_usd = db.Column(db.Float, nullable=True)
    is_enabled = db.Column(db.Boolean, default=True, nullable=False)  # ✅ New column

    freelancer = db.relationship('Freelancer', backref='services', lazy=True)