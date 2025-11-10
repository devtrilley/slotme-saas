import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from datetime import datetime, timezone
from utils.timezone_utils import (
    utc_to_timezone,
    format_time_for_display,
    format_dual_timezone,
    get_freelancer_timezone,
)


def send_booking_confirmation_email(appointment, customer_timezone=None):
    """Send cleaner text booking confirmation (Brevo safe, no ASCII box)"""
    from email_utils import send_branded_customer_reply
    from zoneinfo import ZoneInfo

    freelancer = appointment.freelancer
    user = appointment.user
    slot = appointment.slot
    service = appointment.service

    # Cancel link
    cancel_link = ""
    if appointment.cancel_token:
        from config import BACKEND_ORIGIN

        cancel_link = f"{BACKEND_ORIGIN}/cancel-booking/{appointment.cancel_token}"

    # Time conversion (frozen timezone)
    frozen_tz = ZoneInfo(appointment.freelancer_timezone or "America/New_York")
    slot_date = datetime.strptime(slot.day, "%Y-%m-%d").date()
    utc_time = datetime.strptime(slot.master_time.time_24h, "%H:%M").time()
    utc_dt = datetime.combine(slot_date, utc_time).replace(tzinfo=ZoneInfo("UTC"))
    local_dt = utc_dt.astimezone(frozen_tz)

    # Format for display
    local_time_display = local_dt.strftime("%I:%M %p").lstrip("0")
    timezone_abbr = local_dt.tzname()
    local_date_display = local_dt.strftime("%A, %B %d, %Y")

    # ✅ Clean, no boxes — looks uniform in Gmail/Brevo

    # Optional sections built separately to avoid f-string parser issues
    instructions_block = ""
    if freelancer.booking_instructions:
        instructions_block = (
            "📍 IMPORTANT INSTRUCTIONS\n" + freelancer.booking_instructions + "\n\n"
        )

    cancel_block = ""
    if cancel_link:
        cancel_block = "🔗 Need to cancel or reschedule?\n" + cancel_link + "\n\n"

    body = (
        f"Hi {user.first_name},\n\n"
        "Great news! Your appointment is confirmed. ✅\n\n"
        f"📋 Service: {service.name}\n"
        f"⏱️ Duration: {service.duration_minutes} minutes\n"
        f"📅 Date: {local_date_display}\n"
        f"🕐 Time: {local_time_display} {timezone_abbr}\n"
        f"👤 With: {freelancer.first_name} {freelancer.last_name}\n"
        f"🏢 Business: {freelancer.business_name or 'N/A'}\n\n"
        f"{instructions_block}"
        f"{cancel_block}"
        "Looking forward to seeing you!\n\n"
        "— The SlotMe Team\n"
        "https://slotme.xyz\n"
    )

    send_branded_customer_reply(
        subject=f"✅ Booking Confirmed with {freelancer.business_name or freelancer.first_name}",
        body=body,
        customer_email=user.email,
    )

    print(f"✅ Booking confirmation email sent to {user.email}")


def send_html_email(to_email, subject, html_content):
    """Send HTML email via Brevo SMTP"""
    try:
        smtp_server = os.getenv("BREVO_SMTP_SERVER")
        smtp_port = int(os.getenv("BREVO_SMTP_PORT", 587))
        smtp_login = os.getenv("BREVO_SMTP_LOGIN")
        smtp_password = os.getenv("BREVO_SMTP_PASSWORD")

        msg = MIMEMultipart("alternative")
        msg["From"] = smtp_login
        msg["To"] = to_email
        msg["Subject"] = subject

        html_part = MIMEText(html_content, "html")
        msg.attach(html_part)

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_login, smtp_password)
            server.sendmail(smtp_login, to_email, msg.as_string())

        print(f"✅ Email sent successfully to {to_email}")

    except Exception as e:
        print(f"❌ Email failed: {str(e)}")
        raise


def send_delete_confirmation_email(freelancer, token):
    """Send account deletion confirmation email"""
    from email_utils import send_branded_customer_reply
    from config import FRONTEND_URL

    delete_link = f"{FRONTEND_URL}/delete/confirm/{token}"

    body = f"""Hi {freelancer.first_name},

You requested to permanently delete your SlotMe account.

⚠️ THIS ACTION CANNOT BE UNDONE ⚠️

If you're sure you want to proceed, click the link below to confirm:

🔗 {delete_link}

⏰ This link expires in 15 minutes.

If you did not request this, please ignore this email and your account will remain active.

— The SlotMe Team
"""

    send_branded_customer_reply(
        subject="Confirm your SlotMe account deletion",
        body=body,
        customer_email=freelancer.email,
    )

    print(f"📧 Delete confirmation email sent to {freelancer.email}")
