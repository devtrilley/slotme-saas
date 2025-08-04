# routes/public_routes.py

from flask import Blueprint, request, jsonify
import os
from email_utils import send_feedback_submission

public_bp = Blueprint("public", __name__)


@public_bp.route("/feedback", methods=["POST", "OPTIONS"])
def send_feedback():
    if request.method == "OPTIONS":
        return jsonify({"ok": True}), 200

    data = request.get_json()
    name = data.get("name", "Anonymous")
    email = data.get("email", "unknown@user.com")
    subject = data.get("subject", "No Subject")
    message = data.get("message", "")
    reason = data.get("reason", "General")

    if "@" not in email:
        email = "unknown@user.com"

    body = f"""
Name: {name}
Email: {email}
Reason: {reason}

Message:
{message}
""".strip()

    try:
        send_feedback_submission(
            to=os.getenv("SUPPORT_EMAIL"),  # e.g. support@slotme.xyz
            subject=f"[PUBLIC | {reason}] {subject}",
            body=body,
        )
        return jsonify({"message": "Feedback sent successfully!"}), 200
    except Exception as e:
        print("❌ Feedback email failed:", str(e))
        return jsonify({"error": "Failed to send feedback"}), 500
