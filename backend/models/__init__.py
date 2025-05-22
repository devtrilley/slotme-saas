from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Freelancer(db.Model):
    __tablename__ = 'freelancers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)
    logo_url = db.Column(db.String(300), nullable=True)
    bio = db.Column(db.String(500), nullable=True)
    tagline = db.Column(db.String(200), nullable=True)

    slots = db.relationship('TimeSlot', backref='freelancer', lazy=True)
    appointments = db.relationship('Appointment', backref='freelancer', lazy=True)


class User(db.Model):  # Customer
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=True)

    appointments = db.relationship('Appointment', backref='user', lazy=True)


class TimeSlot(db.Model):
    __tablename__ = 'time_slots'

    id = db.Column(db.Integer, primary_key=True)
    freelancer_id = db.Column(db.Integer, db.ForeignKey('freelancers.id'), nullable=False)
    time = db.Column(db.String(20), nullable=False)
    is_booked = db.Column(db.Boolean, default=False)

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
    confirmed = db.Column(db.Boolean, default=False)
    confirmation_token = db.Column(db.String(64), unique=True, nullable=True)

    slot = db.relationship(
        'TimeSlot',
        back_populates='appointment'
    )