# backend/dev/seed_helpers.py

from datetime import datetime, timezone
from models import db, Appointment, TimeSlot, MasterTimeSlot, Freelancer, Service, User
from werkzeug.security import generate_password_hash
from flask_jwt_extended import create_access_token
from utils.time_utils import utc_today  # or adjust path as needed
from zoneinfo import ZoneInfo
from utils.time_utils import utc_today
from utils.timezone_utils import utc_label_to_datetime


def add_appointment(freelancer, user, service, start_label_local, day):
    """
    Creates a full appointment (booked slot + inherited blocks + appointment record).
    Args:
        freelancer: Freelancer object with timezone info
        user: User object
        service: Service object with duration
        start_label_local: Time label in freelancer's local timezone (e.g., "02:00 PM")
        day: LOCAL date string in ISO format (YYYY-MM-DD) in freelancer's timezone
    """
    # Convert local time label to UTC, including proper date handling
    utc_start_label, utc_day = convert_local_label_to_utc_label(
        start_label_local, freelancer.timezone, day
    )

    if utc_day is None:
        print(f"❌ Failed to convert local time '{start_label_local}' on '{day}'")
        return None

    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]

    try:
        start_index = time_labels.index(utc_start_label)
    except ValueError:
        print(
            f"❌ Invalid UTC time label: {utc_start_label} (converted from local '{start_label_local}')"
        )
        return None

    required_labels = time_labels[
        start_index : start_index + (service.duration_minutes // 15)
    ]

    mt_start = next((mt for mt in all_times if mt.label == utc_start_label), None)
    if not mt_start:
        print(f"❌ No MasterTimeSlot found for UTC label: {utc_start_label}")
        return None

    existing_start = TimeSlot.query.filter_by(
        day=utc_day,  # 🔥 USE UTC DATE
        freelancer_id=freelancer.id,
        master_time_id=mt_start.id,
    ).first()

    if existing_start:
        if not existing_start.is_booked:
            existing_start.is_booked = True
            db.session.commit()
            start_slot = existing_start
        else:
            print(
                f"⭐️ Slot already booked at {utc_start_label} UTC (local: {start_label_local}) for {freelancer.first_name}"
            )
            return None
    else:
        start_slot = TimeSlot(
            day=utc_day,  # 🔥 USE UTC DATE
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
                day=utc_day,  # 🔥 USE UTC DATE
                freelancer_id=freelancer.id,
                master_time_id=mt.id,
            ).first()
            if not existing:
                db.session.add(
                    TimeSlot(
                        day=utc_day,  # 🔥 USE UTC DATE
                        freelancer_id=freelancer.id,
                        master_time_id=mt.id,
                        is_booked=True,
                    )
                )

    db.session.commit()

    appt = Appointment(
        slot_id=start_slot.id,
        freelancer_id=freelancer.id,
        user_id=user.id,
        service_id=service.id,
        status="confirmed",
        timestamp=datetime.now(timezone.utc),
        freelancer_timezone=freelancer.timezone,
    )
    db.session.add(appt)
    db.session.commit()

    print(
        f"✅ Created booking for {user.first_name} {user.last_name} at {start_label_local} ({freelancer.timezone}) -> {utc_start_label} UTC with {freelancer.first_name}"
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
    timezone="America/New_York",  # ✅ Add this line
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
    freelancer.timezone = timezone  # ✅ Set freelancer's timezone
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

    # Add open slots using UTC-converted labels and dates
    from datetime import datetime
    from zoneinfo import ZoneInfo

    # Get today in the freelancer's LOCAL timezone
    tz = ZoneInfo(freelancer.timezone)
    local_today = datetime.now(tz).date()

    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_label_map = {t.label: t for t in all_times}

    for label in open_slot_labels:
        # Convert local time to UTC, getting BOTH the UTC label and UTC date
        utc_label, utc_date = convert_local_label_to_utc_label(
            label, freelancer.timezone, local_today
        )

        if utc_date is None:
            print(f"⚠️ Failed to convert local label '{label}'")
            continue

        mt = time_label_map.get(utc_label)
        if mt:
            db.session.add(
                TimeSlot(
                    day=utc_date,  # 🔥 NOW STORES CORRECT UTC DATE
                    freelancer_id=freelancer.id,
                    master_time_id=mt.id,
                    is_booked=False,
                )
            )
            print(
                f"✅ Created slot: {label} ({freelancer.timezone}) → {utc_label} UTC on {utc_date}"
            )
        else:
            print(
                f"⚠️ No MasterTimeSlot found for UTC label '{utc_label}' (converted from local '{label}')"
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
                # Convert to UTC label first
                converted_label = convert_local_label_to_utc_label(
                    start_label, freelancer.timezone
                )
                mt_start = next(
                    (mt for mt in all_times if mt.label == converted_label), None
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
                    # ✅ Use timezone-safe local comparison
                    existing_label_utc = existing_appt.slot.master_time.label
                    existing_label_local = convert_utc_label_to_local_label(
                        existing_label_utc, freelancer.timezone
                    )

                    if existing_label_local == start_label:
                        print(
                            f"⭐️ Skipping duplicate booking at {start_label} for {user.first_name}"
                        )
                        continue

            # Create appointment
            result = add_appointment(
                freelancer=freelancer,
                user=user,
                service=service,
                start_label_local=start_label,  # pass local label directly
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


def convert_local_label_to_utc_label(label_12h, freelancer_timezone, local_date=None):
    """
    Converts a time label in freelancer's timezone to UTC label.
    NOW CORRECTLY HANDLES DAY SHIFTS for western timezones.

    Args:
        label_12h: Local time like "07:30 PM"
        freelancer_timezone: IANA timezone like "America/Los_Angeles"
        local_date: The LOCAL date this time refers to (defaults to today in freelancer TZ)

    Returns:
        tuple: (utc_label_12h, utc_date) - e.g. ("02:30 AM", "2025-10-15")
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    try:
        # Get the local date in freelancer's timezone if not provided
        if local_date is None:
            tz = ZoneInfo(freelancer_timezone)
            local_date = datetime.now(tz).date()
        elif isinstance(local_date, str):
            local_date = datetime.strptime(local_date, "%Y-%m-%d").date()

        # Parse the time
        parsed_time = datetime.strptime(label_12h.strip(), "%I:%M %p").time()

        # Create timezone-aware datetime in freelancer's LOCAL timezone
        local_dt = datetime.combine(local_date, parsed_time)
        local_dt = local_dt.replace(tzinfo=ZoneInfo(freelancer_timezone))

        # Convert to UTC
        utc_dt = local_dt.astimezone(ZoneInfo("UTC"))

        # Return both UTC label and UTC date
        return utc_dt.strftime("%I:%M %p"), utc_dt.strftime("%Y-%m-%d")
    except Exception as e:
        print(
            f"❌ Error converting '{label_12h}' from {freelancer_timezone} to UTC: {e}"
        )
        return label_12h, None


def convert_utc_label_to_local_label(utc_label_12h, freelancer_timezone):
    """
    Converts a UTC time label back to freelancer's local timezone.
    """
    try:
        parsed_time = datetime.strptime(utc_label_12h.strip(), "%I:%M %p")
        today = utc_today()
        utc_dt = datetime.combine(today, parsed_time.time()).replace(
            tzinfo=ZoneInfo("UTC")
        )
        local_dt = utc_dt.astimezone(ZoneInfo(freelancer_timezone))
        return local_dt.strftime("%I:%M %p")
    except Exception as e:
        print(
            f"❌ Error converting UTC '{utc_label_12h}' to {freelancer_timezone}: {e}"
        )
        return utc_label_12h
