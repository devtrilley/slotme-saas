# This file is pretty much like a .app file in Express that holds all of our routes

from flask import Flask, request, jsonify, redirect, Response, g, make_response, abort
from flask_cors import CORS, cross_origin
from models import db, TimeSlot, Appointment, Freelancer, User, MasterTimeSlot, Service
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re  # Regular Expression
from werkzeug.security import check_password_hash, generate_password_hash
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from datetime import datetime, timedelta
from flask_jwt_extended import (
    verify_jwt_in_request,
    jwt_required,
    get_jwt_identity,
    JWTManager,
    create_access_token,
    get_jwt,
)
from flask_jwt_extended.exceptions import NoAuthorizationError
from config import FRONTEND_URL, BACKEND_ORIGIN, ALLOWED_ORIGINS

from sqlalchemy import text


from datetime import timezone


from email_utils import (
    send_priority_support_ticket,
    send_branded_customer_reply,
    send_feedback_submission,
)

import time

import pytz, os, secrets, stripe, logging, threading

load_dotenv()

# 🔒 ENV CHECK
required_vars = [
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "BREVO_SMTP_LOGIN",
    "BREVO_SMTP_PASSWORD",
    "BREVO_SMTP_SERVER",
    "BREVO_SMTP_PORT",
    "SUPPORT_EMAIL",
    "JWT_SECRET_KEY",
    "SECRET_KEY",
    "FRONTEND_URL",
    "BACKEND_ORIGIN",
]

# missing = [var for var in required_vars if not os.getenv(var)]
# if missing:
#     print("❌ Missing required .env variables:")
#     for var in missing:
#         print(f" - {var}")
#     exit(1)
# else:
#     print("✅ All required environment variables loaded.")
print("⚠️ Env vars will be checked at runtime, not startup")


# DEV ONLY: enable detailed CORS logging
logging.getLogger("flask_cors").level = logging.DEBUG

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")


app = Flask(__name__, instance_relative_config=False)


# Route imports
from routes.auth_routes import auth_bp
from routes.booking_routes import booking_bp
from routes.dev_routes import dev_bp
from routes.freelancer_routes import freelancer_bp
from routes.reminder_routes import reminder_bp
from routes.stripe_routes import stripe_bp, stripe_webhook
from routes.s3_routes import s3_bp


# Add with the other Blueprint imports
from routes.public_routes import public_bp


# Register
app.register_blueprint(auth_bp)
app.register_blueprint(booking_bp)
app.register_blueprint(dev_bp)
# app.register_blueprint(freelancer_bp, url_prefix="/freelancer")
app.register_blueprint(freelancer_bp)
app.register_blueprint(reminder_bp)
app.register_blueprint(stripe_bp)
# Register it below with the others
app.register_blueprint(public_bp)
app.register_blueprint(s3_bp)

app.add_url_rule("/webhook", view_func=stripe_webhook, methods=["POST"])

# 🔌 attach middleware (keeps your allowlists intact)
from utils.middleware import load_freelancer


@app.before_request
def conditional_middleware():
    """Skip middleware for health check"""
    if request.path == "/health":
        return None
    return load_freelancer()


# Allow dev tools (like Postman) to access /dev/* routes
CORS(
    app,
    resources={r"/dev/*": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-Dev-Auth"],
)

# Lock everything else to your frontend
CORS(
    app,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-Dev-Auth"],
)

# 🔐 JWT Token Configuration
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=30)  # Long-lived for UX


def get_database_url():
    """Force SQLite to use backend/instance/scheduler.db in dev"""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("⚠️ DATABASE_URL not found - using local SQLite (forced path)")
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "instance",
            "scheduler.db"
        )
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        return f"sqlite:///{db_path}"
    return db_url

    # Add SSL requirement for Render Postgres
    if db_url.startswith("postgresql://") and "sslmode" not in db_url:
        db_url += "?sslmode=require" if "?" not in db_url else "&sslmode=require"

    return db_url


app.config["SQLALCHEMY_DATABASE_URI"] = get_database_url()
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Only apply PostgreSQL pool settings in production
if os.getenv("DATABASE_URL"):
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,  # Test connections before using them
        "pool_recycle": 300,  # Recycle connections after 5 minutes
    }
db.init_app(app)
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
jwt = JWTManager(app)


@jwt.unauthorized_loader
def custom_unauthorized_response(callback):
    return jsonify({"error": "Missing or invalid token"}), 401


@jwt.expired_token_loader
def custom_expired_token_response(jwt_header, jwt_payload):
    return jsonify({"error": "Token has expired"}), 401


with app.app_context():
    print("🗄️ Creating all tables in", app.config["SQLALCHEMY_DATABASE_URI"])
    db.create_all()


# @app.before_request
@app.route("/")
def index():
    return jsonify({"message": "Server is running!"})


# Health Check Route
@app.route("/health")
def health_check():
    """EB health check endpoint"""
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500


def purge_old_pending():
    with app.app_context():
        print("🧹 Running startup cleanup for expired pending bookings...")
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
        expired = Appointment.query.filter(
            Appointment.status == "pending", Appointment.timestamp < cutoff
        ).all()

        for appt in expired:
            appt.status = "cancelled"
            appt.slot.is_booked = False

        db.session.commit()
        print(f"✅ Cleaned {len(expired)} expired pending bookings.")


def start_pending_cleanup_loop():
    def run_cleanup():
        with app.app_context():
            while True:
                purge_old_pending()
                print("🧹 Pending cleanup ran automatically")
                time.sleep(120)  # Run every 2 minutes (120 sec)

    thread = threading.Thread(target=run_cleanup, daemon=True)
    thread.start()


@app.errorhandler(404)
def handle_404(e):
    origin = request.headers.get("Origin", "*")
    response = jsonify({"error": "Not found"})
    response.status_code = 404
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, Authorization, X-Dev-Auth"
    )
    response.headers["Access-Control-Allow-Methods"] = (
        "GET, POST, PATCH, DELETE, OPTIONS"
    )
    return response


# Call this BEFORE app.run()
start_pending_cleanup_loop()

# Run once at startup
purge_old_pending()
# -----------------------
if __name__ == "__main__":
    # ✅ Only debug in development
    is_production = os.getenv("FLASK_ENV") == "production"
    app.run(debug=not is_production, host="0.0.0.0", port=5000)
