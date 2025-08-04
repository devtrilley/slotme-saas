from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta, timezone
from models import db, Freelancer, Appointment, TimeSlot, MasterTimeSlot, Service, User
from utils.time_utils import utc_today
from utils.jwt_utils import serializer
from services.email_service import send_feedback_submission
from config import ALLOWED_ORIGINS, FRONTEND_ORIGIN
from config import name_pool, ip_attempts

dev_bp = Blueprint("dev", __name__, url_prefix="/dev")


@dev_bp.route("/freelancers", methods=["GET"])
def get_all_freelancers():
    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancers = Freelancer.query.all()
    result = []
    for c in freelancers:
        result.append(
            {
                "id": c.id,
                "first_name": c.first_name,
                "last_name": c.last_name,
                "email": c.email,
                "logo_url": c.logo_url,
                "tagline": c.tagline,
                "bio": c.bio,
                "is_verified": c.is_verified,
            }
        )
    return jsonify(result)


@dev_bp.route("/slots/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_freelancer_slots(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    from sqlalchemy.orm import joinedload

    # Fetch master times in order to get consistent time label order
    master_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_label_to_id = {mt.label: mt.id for mt in master_times}
    time_labels = [mt.label for mt in master_times]

    # Precompute inherited block IDs
    inherited_ids = set()
    appointments = (
        Appointment.query.filter_by(freelancer_id=freelancer_id)
        .filter(Appointment.status != "cancelled")
        .options(
            joinedload(Appointment.slot).joinedload(TimeSlot.master_time),
            joinedload(Appointment.service),
        )
        .all()
    )
    for appt in appointments:
        slot = appt.slot
        service = appt.service
        if not slot or not service:
            continue
        start_label = slot.master_time.label
        try:
            start_idx = time_labels.index(start_label)
            blocks = service.duration_minutes // 15
            inherited_labels = time_labels[start_idx + 1 : start_idx + blocks]
            for label in inherited_labels:
                inherited_id = TimeSlot.query.filter_by(
                    freelancer_id=freelancer_id,
                    day=slot.day,
                    master_time_id=time_label_to_id[label],
                ).first()
                if inherited_id:
                    inherited_ids.add(inherited_id.id)
        except ValueError:
            continue

    # Load all slots
    slots = (
        TimeSlot.query.options(
            joinedload(TimeSlot.master_time),
            joinedload(TimeSlot.appointment).joinedload(Appointment.user),
            joinedload(TimeSlot.appointment).joinedload(Appointment.service),
        )
        .filter_by(freelancer_id=freelancer_id)
        .all()
    )

    result = []
    for slot in slots:
        is_booked = slot.is_booked
        is_inherited = slot.id in inherited_ids
        appointment = slot.appointment
        user_info = None
        service_name = None
        duration_minutes = None

        if is_booked and appointment and not is_inherited:
            user = appointment.user
            service = appointment.service
            if user:
                user_info = {
                    "name": f"{user.first_name} {user.last_name}",
                    "email": user.email,
                }
            if service:
                service_name = service.name
                duration_minutes = service.duration_minutes

        result.append(
            {
                "id": slot.id,
                "time": slot.master_time.label,
                "day": slot.day,
                "is_booked": is_booked,
                "is_inherited_block": is_inherited,
                "appointment": user_info,
                "service_name": service_name,
                "duration_minutes": duration_minutes,
            }
        )

    return jsonify(result)


@dev_bp.route("/freelancers/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_single_freelancer(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    services = Service.query.filter_by(freelancer_id=freelancer.id).all()
    service_data = [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "duration_minutes": s.duration_minutes,
            "price_usd": s.price_usd or 0.0,
            "is_enabled": s.is_enabled,
        }
        for s in services
    ]

    return jsonify(
        {
            "id": freelancer.id,
            "first_name": freelancer.first_name,
            "last_name": freelancer.last_name,
            "email": freelancer.email,
            "phone": freelancer.phone,
            "logo_url": freelancer.logo_url,
            "tagline": freelancer.tagline,
            "bio": freelancer.bio,
            "instagram_url": freelancer.instagram_url,
            "twitter_url": freelancer.twitter_url,
            "is_verified": freelancer.tier in ["pro", "elite"],
            "joined": freelancer.id,  # Replace with created_at if desired
            "services": service_data,
            "faq_text": freelancer.faq_text,
        }
    )


@dev_bp.route("/appointments/<int:freelancer_id>", methods=["GET", "OPTIONS"])
def get_dev_appointments_for_freelancer(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200  # ✅ Allow CORS preflight

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    appointments = Appointment.query.filter_by(freelancer_id=freelancer_id).all()
    result = []
    for a in appointments:
        user = a.user
        result.append(
            {
                "id": a.id,
                "name": f"{user.first_name} {user.last_name}" if user else None,
                "email": a.user.email if a.user else None,
                "slot_day": a.slot.day,
                "slot_time": a.slot.master_time.label,  # ✅ FIXED: use master_time.label
                "status": a.status,
            }
        )

    return jsonify(result)


@dev_bp.route("/freelancers", methods=["POST"])
def create_freelancer():
    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    if Freelancer.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    new_freelancer = Freelancer(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=generate_password_hash(password),
        contact_email=data.get("contact_email") or email,
        email_confirmed=data.get("email_confirmed", False),
        tier=data.get("tier", "free"),
        timezone=data.get("timezone", "America/New_York"),
        logo_url=data.get("logo_url"),
        tagline=data.get("tagline"),
        bio=data.get("bio"),
        phone=data.get("phone"),
    )
    db.session.add(new_freelancer)
    db.session.commit()
    return jsonify({"message": "Freelancer created!"}), 201


@dev_bp.route("/freelancers/<int:freelancer_id>", methods=["DELETE", "OPTIONS"])
@cross_origin(
    origins=ALLOWED_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "X-Dev-Auth"],
)
def delete_freelancer(freelancer_id):
    if request.method == "OPTIONS":
        return jsonify({}), 200  # Preflight OK

    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    db.session.delete(freelancer)
    db.session.commit()

    return jsonify({"message": "Freelancer deleted"}), 200


# SEEDME
@dev_bp.route("/seed-all", methods=["POST"])
def seed_everything():
    auth = request.headers.get("X-Dev-Auth") or request.headers.get("x-dev-auth")
    if auth != "secret123":
        return jsonify({"error": "Forbidden"}), 403

    from models import MasterTimeSlot
    from werkzeug.security import generate_password_hash
    from random import choice

    # 1. Seed 96 master time slots
    db.session.query(MasterTimeSlot).delete()
    start_time = datetime.strptime("00:00", "%H:%M")
    delta = timedelta(minutes=15)
    for i in range(96):
        time_24h = (start_time + i * delta).strftime("%H:%M")
        label = (start_time + i * delta).strftime("%I:%M %p")
        db.session.add(MasterTimeSlot(time_24h=time_24h, label=label))
    db.session.commit()

    # 2. Seed demo freelancer (2 appointments: Jane & John)
    f1 = Freelancer.query.filter_by(email="demo@mail.com").first()
    if not f1:
        f1 = Freelancer(
            first_name="Amber",
            last_name="Gyser",
            business_name="Amber's Love Cafe",
            email="demo@mail.com",
            password=generate_password_hash("demo123"),
            logo_url="https://randomuser.me/api/portraits/women/45.jpg",
            tagline='Let\'s grab "Hot Coffee". Night bookings only...',
            bio="Currently in Charlotte, NC!",
            is_verified=False,
            phone="555-123-4567",
            contact_email="booking@ambercafe.com",
            instagram_url="https://instagram.com/zuck",
            twitter_url="https://twitter.com/elonmusk",
            no_show_policy="Cancel 24h ahead.",
            faq_text="• $10 deposit\n• Come early\n• No-shows forfeit deposit.",
            early_access=False,
        )
        db.session.add(f1)
        db.session.commit()

    # Clear old slots, bookings, and services
    Appointment.query.filter_by(freelancer_id=f1.id).delete()
    TimeSlot.query.filter_by(freelancer_id=f1.id).delete()
    Service.query.filter_by(freelancer_id=f1.id).delete()
    db.session.commit()

    # Seed demo services
    db.session.add_all(
        [
            Service(
                freelancer_id=f1.id,
                name="Quick Espresso Shot",
                description="Fast 15-minute pickup.",
                duration_minutes=15,
                price_usd=25.00,
            ),
            Service(
                freelancer_id=f1.id,
                name="Café au Lay",
                description="Coffee body contact.",
                duration_minutes=45,
                price_usd=50.00,
            ),
            Service(
                freelancer_id=f1.id,
                name="Espresso Eiffel Tower",
                description="For threesomes.",
                duration_minutes=30,
                price_usd=70.00,
            ),
        ]
    )
    db.session.commit()

    # Seed empty slots from 1:00 PM to 4:00 PM
    today = utc_today()
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()

    empty_labels = []
    for hour in range(13, 16):  # 1PM to 3:45PM
        for minute in [0, 15, 30, 45]:
            time_obj = datetime.strptime(f"{hour}:{minute:02d}", "%H:%M").replace(
                tzinfo=timezone.utc
            )
            label = time_obj.strftime(
                "%I:%M %p"
            )  # Always matches master slot label format
            empty_labels.append(label)

    for label in empty_labels:
        mt = next((t for t in all_times if t.label == label), None)
        if not mt:
            continue
        db.session.add(
            TimeSlot(
                day=today.isoformat(),
                freelancer_id=f1.id,
                master_time_id=mt.id,
                is_booked=False,
            )
        )
    db.session.commit()

    today = utc_today()
    demo_bookings = [
        ("Jane", "Doe", "jane.doe@mail.com", "09:00 AM", 45),
        ("John", "Doe", "john.doe@mail.com", "10:00 AM", 30),
    ]
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]
    demo_services = Service.query.filter_by(freelancer_id=f1.id).all()

    for first, last, email, start_label, duration in demo_bookings:
        mt_start = MasterTimeSlot.query.filter_by(label=start_label).first()
        if not mt_start:
            continue
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(first_name=first, last_name=last, email=email)
            db.session.add(user)
            db.session.commit()

        service = next(
            (s for s in demo_services if s.duration_minutes == duration), None
        )
        if not service:
            continue

        start_slot = TimeSlot(
            day=today.isoformat(),
            master_time_id=mt_start.id,
            freelancer_id=f1.id,
            is_booked=True,
        )
        db.session.add(start_slot)
        db.session.commit()

        appt = Appointment(
            slot_id=start_slot.id,
            freelancer_id=f1.id,
            user_id=user.id,
            service_id=service.id,
            status="confirmed",
            timestamp=datetime.now(timezone.utc),
        )
        db.session.add(appt)

        start_index = time_labels.index(start_label)
        required_labels = time_labels[start_index : start_index + (duration // 15)]
        for label in required_labels[1:]:
            mt = next((t for t in all_times if t.label == label), None)
            if not mt:
                continue
            existing = TimeSlot.query.filter_by(
                day=today.isoformat(),
                freelancer_id=f1.id,
                master_time_id=mt.id,
            ).first()
            if not existing:
                db.session.add(
                    TimeSlot(
                        day=today.isoformat(),
                        freelancer_id=f1.id,
                        master_time_id=mt.id,
                        is_booked=True,
                    )
                )
    db.session.commit()

    # ✅ REWRITE ELITE FREELANCER SEEDING TO BE ATOMIC
    f2 = Freelancer.query.filter_by(email="night@mail.com").first()
    if not f2:
        f2 = Freelancer(
            first_name="Ping",
            last_name="Xioma",
            business_name="Ping's Slippery Massage",
            email="night@mail.com",
            password=generate_password_hash("night123"),
            logo_url="https://thumbs.dreamstime.com/b/portrait-beautiful-asian-woman-natural-beauty-face-thai-girl-tanned-skin-full-lips-high-resolution-137168110.jpg",
            tagline="I milk you, we have fun time!",
            bio="Trained in Bangkok. Open late.",
            is_verified=True,
            phone="555-987-6543",
            contact_email="contact@pingmassage.com",
            instagram_url="https://instagram.com/zuck",
            twitter_url="https://twitter.com/elonmusk",
            no_show_policy="Reschedule 12h ahead.",
            faq_text="• Bridal trials\n• Travel fees apply",
            tier="elite",
            early_access=True,
        )
        db.session.add(f2)
        db.session.commit()

        db.session.add_all(
            [
                Service(
                    freelancer_id=f2.id,
                    name="Happy Ending Herbal Rubdown",
                    description="Start stiff, leave smiling.",
                    duration_minutes=60,
                    price_usd=79.99,
                ),
                Service(
                    freelancer_id=f2.id,
                    name="Thai Five-Hand Combo",
                    description="Two-hour escape.",
                    duration_minutes=120,
                    price_usd=149.99,
                ),
            ]
        )
        db.session.commit()

    services = Service.query.filter_by(freelancer_id=f2.id).all()
    elite_bookings = [
        (datetime.now(timezone.utc).date() + timedelta(days=i)).isoformat()
        for i in range(5)
        for _ in range(3)
    ]

    for day_str in elite_bookings:
        label = choice(time_labels[:-8])
        mt_start = MasterTimeSlot.query.filter_by(label=label).first()
        if not mt_start:
            continue

        service = choice(services)
        duration = service.duration_minutes
        start_index = time_labels.index(label)
        required_labels = time_labels[start_index : start_index + (duration // 15)]

        slot = TimeSlot(
            day=day_str,
            master_time_id=mt_start.id,
            freelancer_id=f2.id,
            is_booked=True,
        )
        db.session.add(slot)
        db.session.commit()

        first, last = choice(name_pool)
        email = f"{first.lower()}.{last.lower()}@mail.com"
        user = User(first_name=first, last_name=last, email=email)
        db.session.add(user)
        db.session.commit()

        appt = Appointment(
            slot_id=slot.id,
            freelancer_id=f2.id,
            user_id=user.id,
            service_id=service.id,
            status="confirmed",
            timestamp=datetime.now(timezone.utc),
        )
        db.session.add(appt)

        for label in required_labels[1:]:
            mt = next((t for t in all_times if t.label == label), None)
            if not mt:
                continue
            existing = TimeSlot.query.filter_by(
                day=day_str,
                freelancer_id=f2.id,
                master_time_id=mt.id,
            ).first()
            if not existing:
                db.session.add(
                    TimeSlot(
                        day=day_str,
                        freelancer_id=f2.id,
                        master_time_id=mt.id,
                        is_booked=True,
                    )
                )
    db.session.commit()

    print("Demo freelancer ID:", f1.id)
    print("Elite freelancer ID:", f2.id)

    token1 = create_access_token(identity=str(f1.id))
    token2 = create_access_token(identity=str(f2.id))

    return (
        jsonify(
            {
                "message": "✅ Fully seeded: master times, both freelancers, and bookings.",
                "demo_token": token1,
                "elite_token": token2,
            }
        ),
        200,
    )


# SEEDME


@dev_bp.route("/send-confirmation/<int:freelancer_id>", methods=["POST"])
@cross_origin()
def send_confirmation_email(freelancer_id):
    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    token = serializer.dumps(freelancer.email, salt="email-confirm")
    freelancer.confirmation_token = token
    db.session.commit()

    confirm_url = f"{FRONTEND_ORIGIN}/verify-freelancer?token={token}"
    print(f"🔗 Confirmation link: {confirm_url}")

    send_feedback_submission(
        to=freelancer.email,
        subject="Please confirm your SlotMe email",
        body=f"Click here to confirm: {confirm_url}",
    )

    return jsonify({"message": "Email sent!"}), 200


@dev_bp.route("/cleanup-pending", methods=["POST"])
def cleanup_pending():
    ten_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=10)
    expired = Appointment.query.filter(
        Appointment.status == "pending", Appointment.timestamp < ten_minutes_ago
    ).all()

    for appt in expired:
        appt.status = "cancelled"
        appt.slot.is_booked = False  # Free up slot

    db.session.commit()
    return jsonify({"message": f"Expired {len(expired)} pending appointments."})
