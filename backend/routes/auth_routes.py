from flask import Blueprint, request, jsonify, g, current_app
import re  # ✅ for password validation
from flask_cors import cross_origin
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash
from models import db, Freelancer
from utils.jwt_utils import serializer
from config import ALLOWED_ORIGINS, FRONTEND_URL
from utils.slug_utils import generate_unique_slug  # 🔥 ADD THIS LINE

# keep imports organized + avoid circular issues
from email_utils import (
    send_verification_email,
    send_password_reset_email,
    send_email_change_confirmation,
)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

from itsdangerous import BadSignature, SignatureExpired

# backend/routes/auth_routes.py (add these imports)
from utils.features import FEATURES, all_features_for_tier, normalize_tier
from utils.decorators import require_auth  # assuming you already have this

# 🔒 Simple rate limiting without external dependencies
login_attempts = {}  # Store {ip: [timestamps]}

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# 🔒 SECURITY: Prevent XSS in signup fields
def sanitize_html(text):
    """Convert < > & " ' to safe HTML entities to prevent XSS"""
    if not text:
        return text
    import html

    return html.escape(str(text).strip())


@auth_bp.route("", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def freelancer_login():
    # 🔒 Simple rate limit: 5 attempts per minute
    import time

    client_ip = request.remote_addr
    now = time.time()

    # Clean old attempts (older than 60 seconds)
    if client_ip in login_attempts:
        login_attempts[client_ip] = [
            t for t in login_attempts[client_ip] if now - t < 60
        ]

    # Check if limit exceeded
    if client_ip in login_attempts and len(login_attempts[client_ip]) >= 5:
        return (
            jsonify({"error": "Too many login attempts. Try again in 1 minute."}),
            429,
        )

    # Record this attempt
    if client_ip not in login_attempts:
        login_attempts[client_ip] = []
    login_attempts[client_ip].append(now)

    # Rest of login logic
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

    # 🔐 Issue BOTH access and refresh tokens
    access_token = create_access_token(identity=str(freelancer.id))
    refresh_token = create_refresh_token(identity=str(freelancer.id))

    return (
        jsonify(
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "freelancer_id": freelancer.id,
            }
        ),
        200,
    )


# ✅ Helper for password validation
def is_strong_password(pw: str) -> bool:
    if len(pw) < 8:
        return False
    if not re.search(r"[A-Z]", pw):
        return False
    if not re.search(r"[a-z]", pw):
        return False
    if not re.search(r"[0-9]", pw):
        return False
    if not re.search(r"[^A-Za-z0-9]", pw):
        return False
    return True


@auth_bp.route("/signup", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS)  # 👈 Add this decorator
def signup_freelancer():
    data = request.get_json()
    # 🔒 SANITIZE names displayed in UI/emails/profiles
    first_name = sanitize_html(data.get("first_name"))
    last_name = sanitize_html(data.get("last_name"))
    email = data.get("email")  # Validated with EMAIL_RE, not sanitized
    password = data.get("password")  # Hashed, never displayed raw

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    # ✅ Enforce strong password policy
    if not is_strong_password(password):
        return jsonify({"error": "Password too weak"}), 400

    if Freelancer.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    hashed = generate_password_hash(password)

    # 🔥 Generate token BEFORE creating user
    token = serializer.dumps(email, salt="email-confirm")

    new_freelancer = Freelancer(
        first_name=first_name,
        last_name=last_name,
        email=email,
        contact_email=email,
        password=hashed,
        email_confirmed=False,
        location="",
        confirmation_token=token,  # ✅ Set token at creation
    )

    # 🔥 Generate unique random slug for all new users
    new_freelancer.public_slug = generate_unique_slug()

    db.session.add(new_freelancer)

    # ✅ Send email BEFORE commit (doesn't need DB record yet)
    send_verification_email(to_email=email, token=token)

    # ✅ Single commit at the end
    db.session.commit()
    print(f"📨 Sent email verification for {email}")
    print(f"EMAIL CONFIRM TOKEN: {token}")

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

    # 🔥 IDEMPOTENT: If already confirmed, just return success (no error)
    if freelancer.email_confirmed:
        return jsonify({"message": "Email confirmed successfully!"}), 200

    # First time confirming - update database
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


@auth_bp.route("/refresh", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS, supports_credentials=True)
def refresh_access_token():
    """
    🔄 Refresh endpoint: Takes refresh token, returns new access token
    This allows seamless token renewal without re-login
    """
    from flask_jwt_extended import jwt_required, get_jwt_identity

    # Verify the refresh token in the Authorization header
    try:
        # This decorator will validate the refresh token
        from flask_jwt_extended import verify_jwt_in_request

        verify_jwt_in_request(refresh=True)  # ✅ Explicitly check for refresh token

        # Get the freelancer ID from the refresh token
        freelancer_id = get_jwt_identity()

        # Issue a fresh access token (keeps them logged in)
        new_access_token = create_access_token(identity=freelancer_id)

        return jsonify({"access_token": new_access_token}), 200

    except Exception as e:
        print(f"❌ Refresh token error: {e}")
        return jsonify({"error": "Invalid or expired refresh token"}), 401


@auth_bp.route("/resend-verification", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS)
def resend_verification():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email required"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()

    if not freelancer:
        # Don't reveal if email exists (security)
        return (
            jsonify({"message": "If that email exists, we sent a verification link."}),
            200,
        )

    if freelancer.email_confirmed:
        return jsonify({"message": "Email already verified. You can log in."}), 200

    # Generate new token and send email
    token = serializer.dumps(email, salt="email-confirm")
    freelancer.confirmation_token = token
    db.session.commit()

    send_verification_email(to_email=email, token=token)
    print(f"📨 Resent verification email to {email}")

    return jsonify({"message": "Verification email sent! Check your inbox."}), 200


# -------------------------------------------------------------
# 🧠 Password Reset Flow
# -------------------------------------------------------------
from itsdangerous import URLSafeTimedSerializer

reset_serializer = URLSafeTimedSerializer("RESET_SECRET_KEY")


@auth_bp.route("/forgot-password", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS)
def forgot_password():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Email required"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer:
        # don't reveal if email exists
        return jsonify({"message": "If that email exists, a reset link was sent."}), 200

    token = reset_serializer.dumps(email, salt="password-reset")
    freelancer.reset_token = token
    db.session.commit()
    send_password_reset_email(to_email=email, token=token)
    print(f"📩 Sent password reset link to {email}")
    return jsonify({"message": "Reset link sent if email exists."}), 200


@auth_bp.route("/reset-password", methods=["POST"])
@cross_origin(origins=ALLOWED_ORIGINS)
def reset_password():
    data = request.get_json() or {}
    token = data.get("token")
    new_password = data.get("new_password")

    if not token or not new_password:
        return jsonify({"error": "Missing token or new password"}), 400

    try:
        email = reset_serializer.loads(token, salt="password-reset", max_age=3600)
    except Exception:
        return jsonify({"error": "Invalid or expired token"}), 400

    freelancer = Freelancer.query.filter_by(email=email).first()
    if not freelancer:
        return jsonify({"error": "User not found"}), 404

    # enforce strong password again
    if not is_strong_password(new_password):
        return jsonify({"error": "Password too weak"}), 400

    freelancer.password = generate_password_hash(new_password)
    freelancer.reset_token = None
    db.session.commit()
    print(f"✅ Password reset for {email}")
    return jsonify({"message": "Password updated successfully"}), 200


# ---------------------------
# 1) Request email change (logged-in)
# ---------------------------
@auth_bp.post("/change-email/request")
@cross_origin(
    origins=ALLOWED_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
)
@jwt_required()  # ✅ This validates JWT and sets current_user
def request_email_change():
    """
    Body: { new_email, current_password }
    Sends a confirmation link to the NEW email (stateless token).
    """
    from flask_jwt_extended import get_jwt_identity

    freelancer_id = get_jwt_identity()  # ✅ Gets ID from validated JWT
    if not freelancer_id:
        return jsonify({"error": "Unauthorized"}), 401
    if not freelancer_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    new_email = (data.get("new_email") or "").strip().lower()
    current_password = data.get("current_password") or ""

    if not new_email or not current_password:
        return jsonify({"error": "Missing new_email or current_password"}), 400

    if not EMAIL_RE.match(new_email):
        return jsonify({"error": "Invalid email format"}), 400

    freelancer = Freelancer.query.get(
        int(freelancer_id)
    )  # ✅ JWT identity is stored as string
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    if not check_password_hash(freelancer.password, current_password):
        # generic message avoids leaking which field failed
        return jsonify({"error": "Invalid credentials"}), 401

    if new_email == freelancer.email:
        return jsonify({"error": "New email must be different"}), 400

    # Ensure uniqueness
    if Freelancer.query.filter_by(email=new_email).first():
        return jsonify({"error": "That email is already in use"}), 400

    # Create stateless token with freelancer_id and new_email
    token_payload = {"freelancer_id": str(freelancer.id), "new_email": new_email}
    token = serializer.dumps(token_payload, salt="email-change")

    # Email the link to the NEW email
    send_email_change_confirmation(to_email=new_email, token=token)

    # Generic success to avoid user enumeration
    return (
        jsonify({"message": "If that email is valid, we sent a confirmation link."}),
        200,
    )


# ---------------------------
# 2) Confirm email change (public link)
# ---------------------------
@auth_bp.post("/change-email/confirm")
@cross_origin()
def confirm_email_change():
    """
    Body: { token }
    Verifies token and swaps the freelancer's email.
    """
    from itsdangerous import BadSignature, SignatureExpired

    data = request.get_json() or {}
    token = data.get("token")
    if not token:
        return jsonify({"error": "Missing token"}), 400

    try:
        # 1 hour expiry; tweak if needed
        payload = serializer.loads(token, salt="email-change", max_age=3600)
        freelancer_id = payload.get("freelancer_id")
        new_email = (payload.get("new_email") or "").strip().lower()
    except SignatureExpired:
        return jsonify({"error": "Token expired"}), 400
    except BadSignature:
        return jsonify({"error": "Invalid token"}), 400

    if not freelancer_id or not new_email:
        return jsonify({"error": "Invalid token payload"}), 400

    freelancer = Freelancer.query.get(freelancer_id)
    if not freelancer:
        return jsonify({"error": "Freelancer not found"}), 404

    # 🔥 IDEMPOTENT: If this freelancer already has the new email, just return success
    if freelancer.email == new_email:
        return (
            jsonify({"message": "Email updated. Please log in with your new email."}),
            200,
        )

    # Check if email is taken by ANOTHER freelancer
    existing = Freelancer.query.filter_by(email=new_email).first()
    if existing and existing.id != freelancer.id:
        return jsonify({"error": "Email already in use"}), 400

    # First time changing - update database
    freelancer.email = new_email
    freelancer.contact_email = new_email  # keep contact_email in sync if you use it
    db.session.commit()

    # You can optionally clear refresh tokens / force re-login on FE
    return (
        jsonify({"message": "Email updated. Please log in with your new email."}),
        200,
    )
