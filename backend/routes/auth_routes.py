from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from flask_jwt_extended import create_access_token
from werkzeug.security import check_password_hash, generate_password_hash
from models import db, Freelancer
from utils.jwt_utils import serializer
from services.email_service import send_feedback_submission
from config import ALLOWED_ORIGINS, FRONTEND_ORIGIN

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def freelancer_login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer or not check_password_hash(freelancer.password, password):
        return jsonify({"error": "Invalid login"}), 401

    # ✅ Issue JWT token
    access_token = create_access_token(identity=str(freelancer.id))

    return (
        jsonify(
            {
                "access_token": access_token,
                "freelancer_id": freelancer.id,  # optional, for convenience
            }
        ),
        200,
    )


@auth_bp.route("/signup", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS)  # 👈 Add this decorator
def signup_freelancer():
    data = request.get_json()
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    if Freelancer.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    hashed = generate_password_hash(password)

    new_freelancer = Freelancer(
        first_name=first_name,
        last_name=last_name,
        email=email,
        contact_email=email,
        password=hashed,
        email_confirmed=False,
    )

    db.session.add(new_freelancer)
    db.session.commit()

    # 🔗 Generate confirmation token and send email
    token = serializer.dumps(email, salt="email-confirm")
    new_freelancer.confirmation_token = token
    db.session.commit()

    confirm_url = f"{FRONTEND_ORIGIN}/verify-freelancer?token={token}"
    print(f"📨 Confirmation URL: {confirm_url}")

    # ✅ Send verification email
    send_feedback_submission(
        to=email,
        subject="Verify Your SlotMe Account",
        body=f"""Hey {first_name},

    Thanks for signing up for SlotMe!

    Before you can log in, please confirm your email address by clicking the link below:
    {FRONTEND_ORIGIN}/signup-confirmed

    Once confirmed, you’ll have access to your dashboard and can start booking clients.

    – The SlotMe Team
    """,
    )

    return (
        jsonify({"message": "Signup successful! Please check your email to confirm."}),
        201,
    )


@auth_bp.route("/verify-email", methods=["GET"])
@cross_origin()
def verify_email():
    token = request.args.get("token")
    try:
        email = serializer.loads(token, salt="email-confirm", max_age=3600)
    except:
        return jsonify({"error": "Invalid or expired token"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    freelancer.email_confirmed = True
    freelancer.confirmation_token = None
    db.session.commit()

    return jsonify({"message": "Email confirmed successfully!"}), 200
