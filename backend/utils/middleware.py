from flask import request, jsonify, g
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from flask_jwt_extended.exceptions import NoAuthorizationError, JWTDecodeError
from jwt.exceptions import ExpiredSignatureError, DecodeError, InvalidTokenError
from models import Freelancer
from utils.features import normalize_tier
from utils.navigation_utils import is_valid_public_slug


def load_freelancer():
    request.path = request.path.rstrip("/")

    if "/preview-cancel" in request.path:
        print("✅ [middleware] Detected /preview-cancel in path")

    # 🚨 TOP-LEVEL DEBUG LOGS
    print("\n🛬 NEW REQUEST >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
    print("🔥 METHOD:", request.method)
    print("🔥 PATH:", request.path)
    print("🔥 HEADERS:", dict(request.headers))

    if request.method == "OPTIONS":
        print("🛑 Skipping auth due to OPTIONS request.\n")
        return

    open_prefixes = (
        "/auth",
        "/signup",
        "/seed",
        "/verify",
        "/dev",
        "/404",
        "/master-times",
        # "/appointment",
        "/freelancer/public-info",
        "/freelancer/slots",
        "/freelancer/questions/",
        "/confirm-booking",
        "/cancel-booking",
        "/check-booking-status",
        "/resend-confirmation",
        "/check-session-status",
        "/stripe/check-session-status",
        "/download-ics",
        "/preview-cancel",
        "/public-appointment",
    )

    open_paths = [
        "/book",
        "/feedback",
        "/confirm-booking",
        "/appointment",
        "/download-ics",
        "/webhook",
        "/upgrade-success",
        "/upgrade-cancelled",
    ]

    if any(request.path.startswith(prefix) for prefix in open_prefixes):
        print(f"⚠️ Matched OPEN PREFIX → {request.path}\n")
        return

    if request.path in open_paths:
        print(f"⚠️ Matched OPEN PATH → {request.path}\n")
        return

    if request.endpoint == "public_profile_by_url":
        print(f"⚠️ Matched PUBLIC ENDPOINT → {request.endpoint}\n")
        return

    if is_valid_public_slug(request.path.lower()):
        print(f"⚠️ Matched PUBLIC SLUG → {request.path}\n")
        return

    if request.path == "/404":
        print("⚠️ Matched 404 page — no auth needed\n")
        return

    # 🧱 Enforce Auth
    print("🚫 NO OPEN MATCH FOUND — ENFORCING AUTH")
    print("🚫 Path requiring auth:", request.path)

    try:
        auth_header = request.headers.get("Authorization")
        print("🧪 Authorization Header:", auth_header)

        verify_jwt_in_request()
        g.freelancer_id = get_jwt_identity()
        print("✅ JWT Identity:", g.freelancer_id)

        freelancer = Freelancer.query.get(g.freelancer_id)
        if not freelancer:
            print("❌ No freelancer found in DB for ID:", g.freelancer_id)
            return jsonify({"error": "auth_required"}), 401

        g.freelancer = freelancer
        g.user = {
            "id": freelancer.id,
            "freelancer_id": freelancer.id,
            "tier": normalize_tier(getattr(freelancer, "tier", "free")),
            "email": getattr(freelancer, "email", None),
        }

        print("✅ Auth success. User attached to `g` object.\n")

    except NoAuthorizationError as e:
        print("❌ Missing or invalid JWT token")
        print("❌ Exception:", str(e))
        return jsonify({"error": "auth_required"}), 401

    except (ExpiredSignatureError, JWTDecodeError) as e:
        print("⏰ Token expired or invalid — returning 401 for auto-refresh")
        print("⏰ Exception:", str(e))
        return jsonify({"error": "token_expired"}), 401  # ✅ Triggers axios auto-refresh

    except (DecodeError, InvalidTokenError) as e:
        print("🔐 Token decode/validation error")
        print("🔐 Exception:", str(e))
        return jsonify({"error": "invalid_token"}), 401

    except Exception as e:
        print("💥 UNEXPECTED ERROR during auth!")
        print("💥", str(e))
        return jsonify({"error": "internal_auth_error"}), 500  # Only for truly unexpected errors
