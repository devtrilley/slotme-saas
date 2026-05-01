from flask import Blueprint, jsonify, request
from functools import wraps
import os

reminder_bp = Blueprint("reminder", __name__, url_prefix="/reminder")


def require_dev_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("X-Dev-Auth")
        if auth != os.getenv("DEV_PASSWORD"):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)

    return decorated


@reminder_bp.route("/trigger", methods=["POST"])
@require_dev_auth
def trigger_reminders():
    """
    Manually trigger reminder sends for testing.
    Sends reminders for all confirmed appointments where reminder_sent=False.
    Does NOT filter by tomorrow — useful for local testing.
    POST /reminder/trigger
    Header: X-Dev-Auth: <DEV_PASSWORD>
    """
    from models import db, Appointment
    from services.email_service import send_appointment_reminder
    from datetime import datetime, timezone

    try:
        due = Appointment.query.filter_by(
            status="confirmed",
            reminder_sent=False,
        ).all()

        results = []
        for appt in due:
            try:
                sms_sent = send_appointment_reminder(appt)
                appt.reminder_sent = True
                appt.reminder_sent_at = datetime.now(timezone.utc)
                if sms_sent:
                    appt.sms_reminder_sent = True
                db.session.commit()
                results.append(
                    {
                        "appointment_id": appt.id,
                        "email": appt.user.email,
                        "sms_sent": sms_sent,
                        "status": "sent",
                    }
                )
            except Exception as e:
                db.session.rollback()
                results.append(
                    {
                        "appointment_id": appt.id,
                        "status": "failed",
                        "error": str(e),
                    }
                )

        return (
            jsonify(
                {
                    "processed": len(results),
                    "results": results,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@reminder_bp.route("/status", methods=["GET"])
@require_dev_auth
def reminder_status():
    """
    Check how many appointments have/haven't been reminded.
    GET /reminder/status
    Header: X-Dev-Auth: <DEV_PASSWORD>
    """
    from models import Appointment

    total_confirmed = Appointment.query.filter_by(status="confirmed").count()
    reminded = Appointment.query.filter_by(
        status="confirmed", reminder_sent=True
    ).count()
    pending = Appointment.query.filter_by(
        status="confirmed", reminder_sent=False
    ).count()
    sms_sent = Appointment.query.filter_by(
        status="confirmed", sms_reminder_sent=True
    ).count()

    return (
        jsonify(
            {
                "total_confirmed": total_confirmed,
                "reminder_sent": reminded,
                "reminder_pending": pending,
                "sms_sent": sms_sent,
            }
        ),
        200,
    )
