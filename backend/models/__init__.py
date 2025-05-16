from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class TimeSlot(db.Model):
    __tablename__ = 'time_slots'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
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
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey('time_slots.id'), nullable=False)

    slot = db.relationship(
        'TimeSlot',
        back_populates='appointment'
    )

class Client(db.Model):
    __tablename__ = 'clients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(128), nullable=False)

    time_slots = db.relationship('TimeSlot', backref='client', lazy=True)
    appointments = db.relationship('Appointment', backref='client', lazy=True)