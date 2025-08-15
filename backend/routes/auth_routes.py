from flask import Blueprint, request, jsonify, g
from flask_cors import cross_origin
from flask_jwt_extended import create_access_token
from werkzeug.security import check_password_hash, generate_password_hash
from models import db, Freelancer
from utils.jwt_utils import serializer
from config import ALLOWED_ORIGINS, FRONTEND_ORIGIN

from itsdangerous import BadSignature, SignatureExpired
from email_utils import send_verification_email  # our helper in email_utils.py

# backend/routes/auth_routes.py (add these imports)
from utils.features import FEATURES, all_features_for_tier, normalize_tier
from utils.decorators import require_auth  # assuming you already have this


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def freelancer_login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer or not check_password_hash(freelancer.password, password):
        return jsonify({"error": "Invalid login"}), 401

    # Block login until email is confirmed
    if not getattr(freelancer, "email_confirmed", False):
        return jsonify({"error": "Email not verified"}), 403

    access_token = create_access_token(identity=str(freelancer.id))
    return jsonify({"access_token": access_token, "freelancer_id": freelancer.id}), 200


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
        location="",  # 👈 default so we don’t violate NOT NULL anywhere
    )

    db.session.add(new_freelancer)
    db.session.commit()

    # 🔗 Generate confirmation token and send email
    token = serializer.dumps(email, salt="email-confirm")
    new_freelancer.confirmation_token = token
    db.session.commit()

    # Send the actual tokenized link (frontend route expects ?token=...)
    send_verification_email(to_email=email, token=token)
    print(f"📨 Sent email verification for {email}")

    return (
        jsonify({"message": "Signup successful! Please check your email to confirm."}),
        201,
    )


@auth_bp.route("/verify-email", methods=["GET"])
@cross_origin()
def verify_email():
    token = request.args.get("token")
    if not token:
        return jsonify({"error": "Missing token"}), 400

    try:
        # 1 hour window; bump to 72h if you want (max_age=60*60*24*3)
        email = serializer.loads(token, salt="email-confirm", max_age=3600)
    except SignatureExpired:
        return jsonify({"error": "Token expired"}), 400
    except BadSignature:
        return jsonify({"error": "Invalid token"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    freelancer.email_confirmed = True
    freelancer.confirmation_token = None
    db.session.commit()

    return jsonify({"message": "Email confirmed successfully!"}), 200


# backend/routes/auth_routes.py (add this route below your other auth routes)
@auth_bp.get("/me/features")
@require_auth
def get_my_features():
    user = getattr(g, "user", {}) or {}
    tier = normalize_tier(user.get("tier") or user.get("plan") or "free")
    freelancer_id = user.get("freelancer_id")
    return jsonify(
        {
            "tier": tier,
            "freelancer_id": freelancer_id,
            "features": all_features_for_tier(tier),
            # Optional: help FE show upgrade pills with correct tiers
            "required_tiers": FEATURES,
        }
    )
