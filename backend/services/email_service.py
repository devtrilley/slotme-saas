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
    """Send simple plain text booking confirmation - GUARANTEED TO WORK"""
    from email_utils import send_branded_customer_reply

    freelancer = appointment.freelancer
    user = appointment.user
    slot = appointment.slot
    service = appointment.service

    # Get cancel link if available
    cancel_link = ""
    if appointment.cancel_token:
        from config import BACKEND_ORIGIN

        cancel_link = f"\n\n🔗 Need to cancel? {BACKEND_ORIGIN}/cancel-booking/{appointment.cancel_token}"

    # Convert UTC time to freelancer's local timezone
    from zoneinfo import ZoneInfo

    freelancer_tz = ZoneInfo(freelancer.timezone or "America/New_York")
    slot_date = datetime.strptime(slot.day, "%Y-%m-%d").date()
    utc_time = datetime.strptime(slot.master_time.time_24h, "%H:%M").time()
    utc_dt = datetime.combine(slot_date, utc_time).replace(tzinfo=ZoneInfo("UTC"))

    local_dt = utc_dt.astimezone(freelancer_tz)
    local_time_display = local_dt.strftime("%I:%M %p").lstrip("0")
    timezone_abbr = local_dt.tzname()
    local_date_display = local_dt.strftime("%Y-%m-%d")  # ✅ Extract local date

    # Build simple, reliable email body
    body = f"""Hi {user.first_name},

Your appointment has been confirmed! ✅

📅 APPOINTMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service: {service.name}
Duration: {service.duration_minutes} minutes
Date: {local_date_display}
Time: {local_time_display} ({timezone_abbr})
With: {freelancer.first_name} {freelancer.last_name}
{f'Business: {freelancer.business_name}' if freelancer.business_name else ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{f'📝 IMPORTANT INSTRUCTIONS:\n{freelancer.booking_instructions}\n' if freelancer.booking_instructions else ''}
Looking forward to seeing you!
{cancel_link}

— The SlotMe Team
"""

    # Use the EXACT same system as the confirmation link email (which works)
    send_branded_customer_reply(
        subject=f"Booking Confirmed with {freelancer.business_name or 'your freelancer'}",
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
