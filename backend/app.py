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

missing = [var for var in required_vars if not os.getenv(var)]
if missing:
    print("❌ Missing required .env variables:")
    for var in missing:
        print(f" - {var}")
    exit(1)
else:
    print("✅ All required environment variables loaded.")


# DEV ONLY: enable detailed CORS logging
logging.getLogger("flask_cors").level = logging.DEBUG

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")


from config import FRONTEND_ORIGIN, BACKEND_ORIGIN, ALLOWED_ORIGINS

app = Flask(__name__)
# Route imports
from routes.auth_routes import auth_bp
from routes.booking_routes import booking_bp
from routes.dev_routes import dev_bp
from routes.freelancer_routes import freelancer_bp
from routes.reminder_routes import reminder_bp
from routes.stripe_routes import stripe_bp, stripe_webhook

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

app.add_url_rule("/webhook", view_func=stripe_webhook, methods=["POST"])

# 🔌 attach middleware (keeps your allowlists intact)
from utils.middleware import load_freelancer

app.before_request(load_freelancer)

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

app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=15)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///scheduler.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
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
    db.create_all()


# @app.before_request
@app.route("/")
def index():
    return jsonify({"message": "Server is running!"})


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
    app.run(debug=True)
