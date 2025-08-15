# backend/dev/seed_helpers.py

from datetime import datetime, timezone
from models import db, Appointment, TimeSlot, MasterTimeSlot, Freelancer, Service, User
from werkzeug.security import generate_password_hash
from flask_jwt_extended import create_access_token
from utils.time_utils import utc_today  # or adjust path as needed


def add_appointment(freelancer, user, service, start_label, day):
    """Creates a full appointment (booked slot + inherited blocks + appointment record)."""
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]
    start_index = time_labels.index(start_label)
    required_labels = time_labels[
        start_index : start_index + (service.duration_minutes // 15)
    ]

    # Book starting slot
    mt_start = next((mt for mt in all_times if mt.label == start_label), None)
    if not mt_start:
        return None

    start_slot = TimeSlot(
        day=day,
        master_time_id=mt_start.id,
        freelancer_id=freelancer.id,
        is_booked=True,
    )
    db.session.add(start_slot)
    db.session.commit()

    # Book inherited blocks
    for label in required_labels[1:]:
        mt = next((t for t in all_times if t.label == label), None)
        if mt:
            existing = TimeSlot.query.filter_by(
                day=day, freelancer_id=freelancer.id, master_time_id=mt.id
            ).first()
            if not existing:
                db.session.add(
                    TimeSlot(
                        day=day,
                        freelancer_id=freelancer.id,
                        master_time_id=mt.id,
                        is_booked=True,
                    )
                )

    db.session.commit()

    # Create appointment
    appt = Appointment(
        slot_id=start_slot.id,
        freelancer_id=freelancer.id,
        user_id=user.id,
        service_id=service.id,
        status="confirmed",
        timestamp=datetime.now(timezone.utc),
    )
    db.session.add(appt)
    db.session.commit()

    return appt


def seed_freelancer(
    *,
    email,
    first_name,
    last_name,
    business_name,
    password,
    tagline,
    bio,
    logo_url,
    phone,
    contact_email,
    instagram_url,
    twitter_url,
    no_show_policy,
    faq_items,
    booking_instructions,
    preferred_payment_methods,
    location,
    tier=None,
    early_access=False,
    is_verified=True,
    services=[],
    open_slot_labels=[],
    demo_bookings=[],
):
    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer:
        freelancer = Freelancer(
            email=email,
            first_name=first_name,
            last_name=last_name,
            business_name=business_name,
            password=generate_password_hash(password),
            tagline=tagline,
            bio=bio,
            logo_url=logo_url,
            phone=phone,
            contact_email=contact_email,
            instagram_url=instagram_url,
            twitter_url=twitter_url,
            no_show_policy=no_show_policy,
            faq_items=faq_items,
            booking_instructions=booking_instructions,
            preferred_payment_methods=preferred_payment_methods,
            location=location,
            email_confirmed=True,
            tier=tier,
            early_access=early_access,
            is_verified=is_verified,
        )
        db.session.add(freelancer)
        db.session.commit()

    # Wipe old data
    Appointment.query.filter_by(freelancer_id=freelancer.id).delete()
    TimeSlot.query.filter_by(freelancer_id=freelancer.id).delete()
    Service.query.filter_by(freelancer_id=freelancer.id).delete()
    db.session.commit()

    # Add services
    for svc in services:
        db.session.add(Service(freelancer_id=freelancer.id, **svc))
    db.session.commit()

    # Add open slots
    today = utc_today()
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    for label in open_slot_labels:
        mt = next((t for t in all_times if t.label == label), None)
        if mt:
            db.session.add(
                TimeSlot(
                    day=today.isoformat(),
                    freelancer_id=freelancer.id,
                    master_time_id=mt.id,
                    is_booked=False,
                )
            )
    db.session.commit()

    # Seed demo bookings (optional)
    if demo_bookings:
        demo_services = Service.query.filter_by(freelancer_id=freelancer.id).all()
        for first, last, email, start_label, duration in demo_bookings:
            user = User.query.filter_by(email=email).first()
            if not user:
                user = User(first_name=first, last_name=last, email=email)
                db.session.add(user)
                db.session.commit()
            service = next(
                (s for s in demo_services if s.duration_minutes == duration), None
            )
            if service:
                add_appointment(
                    freelancer=freelancer,
                    user=user,
                    service=service,
                    start_label=start_label,
                    day=today.isoformat(),
                )

    return freelancer, create_access_token(identity=str(freelancer.id))
