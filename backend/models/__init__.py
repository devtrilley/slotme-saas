from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON


db = SQLAlchemy()


class Freelancer(db.Model):
    __tablename__ = "freelancers"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    business_name = db.Column(db.String(150), nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    logo_url = db.Column(db.String(300), nullable=True)
    bio = db.Column(db.String(500), nullable=True)
    tagline = db.Column(db.String(200), nullable=True)
    timezone = db.Column(db.String(50), default="America/New_York")  # Default to EST
    is_verified = db.Column(db.Boolean, default=False)
    no_show_policy = db.Column(db.Text, nullable=True)
    faq_items = db.Column(JSON, nullable=True)  # List of {"q": "...", "a": "..."}
    custom_questions_enabled = db.Column(db.Boolean, default=False)
    custom_questions = db.Column(JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    early_access = db.Column(db.Boolean, default=False)
    email_confirmed = db.Column(db.Boolean, default=False)
    confirmation_token = db.Column(db.String(128), nullable=True)
    booking_instructions = db.Column(db.Text, nullable=True)
    preferred_payment_methods = db.Column(db.String(120), nullable=True)
    location = db.Column(db.String(120), nullable=True, default="")

    # ✅ Tier field added here
    tier = db.Column(db.String(20), default="free")  # "free", "pro", "elite"

    # ✅ Stripe customer ID (used to prevent duplicate creation)
    stripe_customer_id = db.Column(db.String(100), nullable=True)
    
    # ✅ Stripe subscription ID (used for cancellation)
    stripe_subscription_id = db.Column(db.String(100), nullable=True)

    # 🗑️ Account deletion flow
    delete_token = db.Column(db.String(255), nullable=True)
    delete_token_expiry = db.Column(db.DateTime, nullable=True)

    custom_url = db.Column(db.String(50), unique=True, nullable=True)
    public_slug = db.Column(db.String(12), unique=True, nullable=True)  # 8-char random slug for all users

    # ✅ New contact fields
    contact_email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    instagram_url = db.Column(db.String(200), nullable=True)
    twitter_url = db.Column(db.String(200), nullable=True)

    business_address = db.Column(
        db.String(300), nullable=True
    )  # ✅ Optional business address

    slots = db.relationship(
        "TimeSlot", backref="freelancer", lazy=True, cascade="all, delete-orphan"
    )
    appointments = db.relationship(
        "Appointment", backref="freelancer", lazy=True, cascade="all, delete-orphan"
    )
    services = db.relationship(
        "Service", backref="freelancer", lazy=True, cascade="all, delete-orphan"
    )


class User(db.Model):  # Customer
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=True)

    appointments = db.relationship("Appointment", backref="user", lazy=True)


class MasterTimeSlot(db.Model):
    __tablename__ = "master_time_slots"

    id = db.Column(db.Integer, primary_key=True)
    time_24h = db.Column(db.String(5), nullable=False, unique=True)  # e.g., "13:15"
    label = db.Column(db.String(10), nullable=False)  # e.g., "1:15 PM"

    slots = db.relationship("TimeSlot", back_populates="master_time")


class TimeSlot(db.Model):
    __tablename__ = "time_slots"

    id = db.Column(db.Integer, primary_key=True)
    freelancer_id = db.Column(
        db.Integer, db.ForeignKey("freelancers.id"), nullable=False
    )
    day = db.Column(db.String(10), nullable=False)  # format: "YYYY-MM-DD"
    master_time_id = db.Column(
        db.Integer, db.ForeignKey("master_time_slots.id"), nullable=False
    )
    is_booked = db.Column(db.Boolean, default=False)

    # ✅ New field to track inherited block status
    is_inherited_block = db.Column(db.Boolean, default=False)

    # 🔥 NEW: Freeze timezone at creation time
    timezone = db.Column(db.String(50), nullable=True)  # e.g., "America/Los_Angeles"

    master_time = db.relationship("MasterTimeSlot", back_populates="slots")
    appointment = db.relationship("Appointment", back_populates="slot", uselist=False)
    # 🔥 REMOVED OLD CONSTRAINT - will be replaced by migration


class Appointment(db.Model):
    __tablename__ = "appointments"

    id = db.Column(db.Integer, primary_key=True)
    freelancer_id = db.Column(
        db.Integer, db.ForeignKey("freelancers.id"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey("time_slots.id"), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    email = db.Column(db.String(120))  # optional at first
    phone = db.Column(db.String(20))  # optional at first

    # ⬇️ New status field replaces need for confirmed/cancelled booleans
    status = db.Column(
        db.String(20), default="pending"
    )  # 'pending', 'confirmed', 'cancelled'

    confirmation_token = db.Column(db.String(64), unique=True, nullable=True)
    cancel_token = db.Column(db.String(64), unique=True, nullable=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=True)
    freelancer_timezone = db.Column(db.String(50), nullable=False)

    slot = db.relationship("TimeSlot", back_populates="appointment")

    service = db.relationship("Service")

    # ✅ Responses to custom questions
    custom_responses = db.Column(JSON, nullable=True)  # {"Question?": "Answer"}

    def to_dict(self):
        return {
            "id": self.id,
            "name": (
                f"{self.user.first_name} {self.user.last_name}"
                if self.user
                else "Unknown"
            ),
            "email": self.email or (self.user.email if self.user else ""),
            "slot_day": self.slot.day if self.slot else None,
            "slot_time": (
                self.slot.master_time.label
                if self.slot and self.slot.master_time
                else ""
            ),
            "freelancer_timezone": self.freelancer_timezone
            or (self.freelancer.timezone if self.freelancer else "America/New_York"),
            "service": self.service.name if self.service else "",
            "service_duration_minutes": (
                self.service.duration_minutes if self.service else None
            ),
            "status": self.status,
        }


class Service(db.Model):
    __tablename__ = "services"

    id = db.Column(db.Integer, primary_key=True)
    freelancer_id = db.Column(
        db.Integer, db.ForeignKey("freelancers.id"), nullable=False
    )
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300), nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=False)
    price_usd = db.Column(db.Float, nullable=True)
    is_enabled = db.Column(db.Boolean, default=True, nullable=False)  # ✅ New column
