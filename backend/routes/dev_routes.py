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
from dev.seed_helpers import seed_freelancer, add_appointment


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
                "tier": c.tier,
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
            "is_verified": freelancer.is_verified,
            "joined": freelancer.id,  # Replace with created_at if desired
            "services": service_data,
            "faq_items": freelancer.faq_items,
            "location": freelancer.location,
            "booking_instructions": freelancer.booking_instructions,
            "preferred_payment_methods": freelancer.preferred_payment_methods,
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
    f1, token = seed_freelancer(
        email="emily@sattutorpro.com",
        first_name="Emily",
        last_name="Carson",
        business_name="SmartStart Tutoring",
        password="emily123",
        tagline="Score higher. Stress less.",
        bio=(
            "I'm Emily, an experienced SAT tutor passionate about helping high school students boost their scores "
            "and get into their dream schools. I've helped over 100 students increase their scores by 100+ points "
            "with personalized strategies and practice plans."
        ),
        logo_url="https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        phone="555-786-0923",
        contact_email="emily@sattutorpro.com",
        instagram_url="https://instagram.com/smartstart.sat",
        twitter_url="https://twitter.com/satwizemily",
        no_show_policy="No-shows result in loss of session credit. Please cancel or reschedule at least 12 hours in advance.",
        faq_items=[
            {
                "question": "What’s your SAT score?",
                "answer": "I scored a 1550 with a perfect 800 in Math.",
            },
            {
                "question": "Do you work with students with learning differences?",
                "answer": "Absolutely — I tailor my approach for all learning styles.",
            },
            {
                "question": "Do you offer group tutoring?",
                "answer": "Not right now, but it’s coming soon!",
            },
        ],
        booking_instructions="Please bring recent practice scores and show up on Zoom 5 mins early with a quiet space.",
        preferred_payment_methods="Stripe (card), PayPal",
        location="Raleigh, NC",
        services=[
            {
                "name": "SAT Diagnostic Session",
                "description": "A full evaluation of your strengths and weaknesses across all SAT sections.",
                "duration_minutes": 60,
                "price_usd": 40.00,
            },
            {
                "name": "SAT Math Focus",
                "description": "Targeted help with algebra, geometry, and problem solving.",
                "duration_minutes": 45,
                "price_usd": 35.00,
            },
            {
                "name": "Reading + Writing Boost",
                "description": "Focus on critical reading, grammar, and timed writing techniques.",
                "duration_minutes": 45,
                "price_usd": 35.00,
            },
        ],
        open_slot_labels=[
            "01:00 PM",
            "01:15 PM",
            "01:30 PM",
            "01:45 PM",
            "02:00 PM",
            "02:15 PM",
            "02:30 PM",
            "02:45 PM",
            "03:00 PM",
            "03:15 PM",
            "03:30 PM",
            "03:45 PM",
        ],
        demo_bookings=[
            ("Jane", "Doe", "jane.doe@mail.com", "09:00 AM", 45),
            ("John", "Doe", "john.doe@mail.com", "10:00 AM", 30),
        ],
    )
    # 3. Seed Malik Jones (Pro Tier Barber)
    f2, token2 = seed_freelancer(
        email="malik@fadekings.com",
        first_name="Malik",
        last_name="Jones",
        business_name="Fade Kings",
        password="malik123",
        tagline="Fresh fades. Clean lines. Always sharp.",
        bio=(
            "I'm Malik, a licensed barber with 7+ years of experience specializing in clean fades, sharp lines, and premium grooming. "
            "Whether you're prepping for an event or just need your weekly fresh cut, I've got you. Located in downtown Atlanta — book ahead to skip the wait."
        ),
        logo_url="https://images.unsplash.com/photo-1567894340315-735d7c361db0?q=80&w=1474&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        phone="555-902-3344",
        contact_email="malik@fadekings.com",
        instagram_url="https://instagram.com/fadesbymalik",
        twitter_url="https://twitter.com/malikcuts",
        no_show_policy="Late by 10+ minutes? Appointment is canceled. No-show once? Full charge. No-show twice? You’ll need to find another barber.",
        faq_items=[
            {"question": "Do you cut kids’ hair?", "answer": "Yes, age 5 and up."},
            {
                "question": "Do you do mobile visits?",
                "answer": "Not at this time — in-shop only.",
            },
            {
                "question": "Want a custom design or part?",
                "answer": "DM me on IG before booking.",
            },
        ],
        booking_instructions="Come with clean, product-free hair. No guests in the chair. Show up early, not late.",
        preferred_payment_methods="Cash, Zelle, Apple Pay",
        location="Atlanta, GA",
        tier="pro",
        early_access=True,
        is_verified=True,
        services=[
            {
                "name": "Fade + Line Up",
                "description": "Classic fade with razor-sharp lineup and detail finish.",
                "duration_minutes": 45,
                "price_usd": 30.00,
            },
            {
                "name": "Beard Sculpt + Trim",
                "description": "Full beard trim and shaping with straight razor finish.",
                "duration_minutes": 30,
                "price_usd": 20.00,
            },
            {
                "name": "Cut + Beard Combo",
                "description": "Full haircut and beard package for the cleanest look.",
                "duration_minutes": 60,
                "price_usd": 45.00,
            },
        ],
        open_slot_labels=[
            "02:00 PM",
            "02:15 PM",
            "02:30 PM",
            "02:45 PM",
            "03:00 PM",
            "03:15 PM",
            "03:30 PM",
            "03:45 PM",
            "04:00 PM",
            "04:15 PM",
            "04:30 PM",
            "04:45 PM",
        ],
    )
    # 4. Seed Jade Bryant (Elite Tier Esthetician)
    f3, token3 = seed_freelancer(
        email="jade@glowskinbar.com",
        first_name="Jade",
        last_name="Bryant",
        business_name="Glow Skin Bar",
        password="jade123",
        tagline="Glow up. Show up. Repeat.",
        bio=(
            "I'm Jade, a licensed esthetician helping women and men achieve glowing, healthy skin with science-backed treatments. "
            "I specialize in acne correction, hydration facials, and skin barrier restoration — all with a luxe, relaxing experience. "
            "Located in Houston, TX. Come get your glow on ✨"
        ),
        logo_url="https://images.pexels.com/photos/8072270/pexels-photo-8072270.jpeg",
        phone="555-982-7782",
        contact_email="jade@glowskinbar.com",
        instagram_url="https://instagram.com/glowskinbar.atl",
        twitter_url="https://twitter.com/glowjade",
        no_show_policy="Deposits are non-refundable. No-shows or cancellations within 24 hours lose their deposit. Please respect my time — I respect yours.",
        faq_items=[
            {
                "question": "Do you work with sensitive skin?",
                "answer": "Yes — I use gentle, pregnancy-safe products.",
            },
            {
                "question": "Can I wear makeup after a facial?",
                "answer": "Wait at least 24 hours to let your skin heal.",
            },
            {
                "question": "Do you sell products?",
                "answer": "DM me or ask after your session — I only recommend what works.",
            },
        ],
        booking_instructions="Please come with a clean face. No guests allowed in the studio. Late = forfeit appointment.",
        preferred_payment_methods="Card on file, Venmo (business), Cash App",
        location="Houston, TX",
        tier="elite",
        early_access=True,
        is_verified=True,
        services=[
            {
                "name": "Custom Facial",
                "description": "A full glow-up tailored to your skin needs. Cleanse, extract, hydrate, and glow.",
                "duration_minutes": 60,
                "price_usd": 60.00,
            },
            {
                "name": "Brow Sculpt & Tint",
                "description": "Perfectly shaped brows with tint for definition and pop.",
                "duration_minutes": 30,
                "price_usd": 25.00,
            },
            {
                "name": "Glow Ritual Package",
                "description": "Facial + brow sculpt + under-eye refresh. The full Jade experience.",
                "duration_minutes": 90,
                "price_usd": 80.00,
            },
        ],
        open_slot_labels=[
            "06:00 PM",
            "06:15 PM",
            "06:30 PM",
            "06:45 PM",
            "07:00 PM",
            "07:15 PM",
            "07:30 PM",
            "07:45 PM",
        ],
    )

    token3 = create_access_token(identity=str(f3.id))

    token2 = create_access_token(identity=str(f2.id))

    today = utc_today()
    demo_bookings = [
        ("Jane", "Doe", "jane.doe@mail.com", "09:00 AM", 45),
        ("John", "Doe", "john.doe@mail.com", "10:00 AM", 30),
    ]
    all_times = MasterTimeSlot.query.order_by(MasterTimeSlot.id).all()
    time_labels = [t.label for t in all_times]
    demo_services = Service.query.filter_by(freelancer_id=f1.id).all()

    for first, last, email, start_label, duration in demo_bookings:
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

        add_appointment(
            freelancer=f1,
            user=user,
            service=service,
            start_label=start_label,
            day=today.isoformat(),
        )

    # ✅ REWRITE ELITE FREELANCER SEEDING TO BE ATOMIC

    print("Emily freelancer ID:", f1.id)
    # print("Elite freelancer ID:", f2.id)

    token = create_access_token(identity=str(f1.id))
    # token2 = create_access_token(identity=str(f2.id))

    return (
        jsonify(
            {
                "message": "✅ Seeded: Emily (Free), Malik (Pro), Jade (Elite)",
                "emily_token": token,
                "malik_token": token2,
                "jade_token": token3,
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
