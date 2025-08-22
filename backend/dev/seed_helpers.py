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

    print(
        f"✅ Created booking for {user.first_name} {user.last_name} at {start_label} with {freelancer.first_name}"
    )

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
    force_bookings=False,
):
    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer:
        freelancer = Freelancer(email=email)
        db.session.add(freelancer)

    # Update or overwrite all fields
    freelancer.email = email  # ✅ <-- ADD THIS LINE BACK IN
    freelancer.first_name = first_name
    freelancer.last_name = last_name
    freelancer.business_name = business_name
    freelancer.password = generate_password_hash(password)
    freelancer.tagline = tagline
    freelancer.bio = bio
    freelancer.logo_url = logo_url
    freelancer.phone = phone
    freelancer.contact_email = contact_email
    freelancer.instagram_url = instagram_url
    freelancer.twitter_url = twitter_url
    freelancer.no_show_policy = no_show_policy
    freelancer.faq_items = faq_items
    freelancer.booking_instructions = booking_instructions
    freelancer.preferred_payment_methods = preferred_payment_methods
    freelancer.location = location
    freelancer.email_confirmed = True
    freelancer.tier = tier
    freelancer.early_access = early_access
    freelancer.is_verified = is_verified

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

    # Seed demo bookings with improved logic
    if demo_bookings:
        demo_services = Service.query.filter_by(freelancer_id=freelancer.id).all()
        today = utc_today()
        all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()

        for booking_data in demo_bookings:
            # Handle both old format (duration) and new format (service_name)
            if len(booking_data) == 5:
                if isinstance(booking_data[4], str):
                    first, last, email, start_label, service_name = booking_data
                    service = next(
                        (s for s in demo_services if s.name == service_name), None
                    )
                else:
                    first, last, email, start_label, duration = booking_data
                    service = next(
                        (s for s in demo_services if s.duration_minutes == duration),
                        None,
                    )
            else:
                print(f"❌ Invalid booking data format: {booking_data}")
                continue

            if not service:
                print(f"❌ No service found for booking: {booking_data}")
                continue

            user = User.query.filter_by(email=email).first()
            if not user:
                user = User(first_name=first, last_name=last, email=email)
                db.session.add(user)
                db.session.commit()

            # Skip duplicate check if force_bookings=True
            if not force_bookings:
                mt_start = next(
                    (mt for mt in all_times if mt.label == start_label), None
                )
                if not mt_start:
                    print(f"❌ Invalid time label: {start_label}")
                    continue

                existing_appt = (
                    Appointment.query.join(TimeSlot)
                    .filter(
                        Appointment.user_id == user.id,
                        Appointment.freelancer_id == freelancer.id,
                        Appointment.service_id == service.id,
                        Appointment.slot_id == TimeSlot.id,
                        TimeSlot.master_time_id == mt_start.id,
                        TimeSlot.day == today.isoformat(),
                    )
                    .first()
                )

                if existing_appt:
                    print(
                        f"⏭️  Skipping duplicate booking for {user.first_name} {user.last_name}"
                    )
                    continue

            # Create appointment
            result = add_appointment(
                freelancer=freelancer,
                user=user,
                service=service,
                start_label=start_label,
                day=today.isoformat(),
            )

            if result:
                print(
                    f"✅ Created booking for {user.first_name} {user.last_name} - {service.name} at {start_label}"
                )
            else:
                print(
                    f"❌ Failed to create booking for {user.first_name} {user.last_name}"
                )

    return freelancer, create_access_token(identity=str(freelancer.id))
