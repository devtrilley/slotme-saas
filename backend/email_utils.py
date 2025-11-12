# send_priority_support_ticket: Inbound from Elite freelancer → you
# send_branded_customer_reply: Outbound from you → any customer/freelancer
# send_feedback_submission: Inbound from public user → you

import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

load_dotenv()

# ✅ FRONTEND_URL (used for all app links)
try:
    from config import FRONTEND_URL  # standard Flask config import
except Exception:
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

SMTP_SERVER = os.getenv("BREVO_SMTP_SERVER")
SMTP_PORT = int(os.getenv("BREVO_SMTP_PORT", 587))
SMTP_LOGIN = os.getenv("BREVO_SMTP_LOGIN")
SMTP_PASSWORD = os.getenv("BREVO_SMTP_PASSWORD")
SUPPORT_RECEIVER = os.getenv("SUPPORT_EMAIL")


# (Formerly send_support_email)
# 🟢 USED IN: PrioritySupport.jsx
# 📤 SENDS TO: You (support@slotme.xyz)
# 🧠 PURPOSE: Logged-in Elite freelancers can submit a ticket. This function lets them message you directly. The email comes from SlotMe Support, but the Reply-To is their real email (so if you hit reply, it talks to them directly).
# ✅ For handling incoming support requests.
def send_priority_support_ticket(subject, body, sender_email):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "SlotMe Support <support@slotme.xyz>"
    msg["Reply-To"] = sender_email  # 👈 lets you reply directly to the customer
    msg["To"] = SUPPORT_RECEIVER
    msg.set_content(body)

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_LOGIN, SMTP_PASSWORD)
        server.send_message(msg)


# (Formerly send_reply_email)
# 🟢 USED BY YOU, when you want to reply back to the customer/freelancer.
# 📤 SENDS TO: Them (user’s actual email)
# 🧠 PURPOSE: Sends an email from SlotMe Support <support@slotme.xyz> to a user. Could be used after a Priority ticket or Feedback submission.
# ✅ For replying with official branded messages.
def send_branded_customer_reply(subject, body, customer_email):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = "SlotMe Support <support@slotme.xyz>"  # keep it branded
    msg["To"] = customer_email
    msg.set_content(body)

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_LOGIN, SMTP_PASSWORD)
        server.send_message(msg)


# (Formerly send_email)
# 🟢 USED IN: Feedback.jsx
# 📤 SENDS TO: You (support@slotme.xyz)
# 🧠 PURPOSE: General users (not logged-in freelancers) can submit feedback, feature ideas, or complaints. The email goes to you.
# ✅ For anonymous or public-facing feedback.
def send_feedback_submission(to, subject, body):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = (
        "SlotMe Support <support@slotme.xyz>"  # 👈 HARD SET TO VERIFIED SENDER
    )
    msg["To"] = to
    msg.set_content(body)

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_LOGIN, SMTP_PASSWORD)
            server.send_message(msg)
        print("✅ Email sent!")
    except Exception as e:
        print("❌ EMAIL ERROR:", str(e))
        raise


if __name__ == "__main__":
    print("BREVO_SMTP_SERVER:", SMTP_SERVER)
    print("BREVO_SMTP_PORT:", SMTP_PORT)
    print("BREVO_SMTP_LOGIN:", SMTP_LOGIN)
    print("BREVO_SMTP_PASSWORD:", SMTP_PASSWORD[:8] + "...")
    print("SUPPORT_RECEIVER:", SUPPORT_RECEIVER)


def send_verification_email(to_email: str, token: str):
    """
    Sends a styled text-based email verification for new freelancers (Brevo-safe).
    """
    try:
        from config import FRONTEND_URL
    except Exception:
        FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    verify_url = f"{FRONTEND_URL}/signup-confirmed?token={token}"

    subject = "✅ Confirm Your Email – SlotMe"
    body = f"""Hi there,

Welcome to SlotMe! 🎉

Please confirm your email to finish setting up your account.

🔗 Verify your email:
{verify_url}

Once verified, you'll be able to create your booking page and start accepting clients instantly.

If you didn't request this, you can safely ignore this email.

— The SlotMe Team
https://slotme.xyz
"""

    send_branded_customer_reply(
        subject=subject,
        body=body,
        customer_email=to_email,
    )


assert FRONTEND_URL, "FRONTEND_URL not set — check config or .env"


def send_password_reset_email(to_email, token):
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    subject = "🔐 Reset your SlotMe password"
    body = f"""Hi there,

You requested to reset your SlotMe password.

🔗 Reset your password:
{reset_link}

⏰ This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

— The SlotMe Team
https://slotme.xyz
"""
    send_branded_customer_reply(subject=subject, body=body, customer_email=to_email)


def _FRONTEND_URL_fallback():
    try:
        from config import FRONTEND_URL

        return FRONTEND_URL
    except Exception:
        return os.getenv("FRONTEND_URL", "http://localhost:5173")


def send_email_change_confirmation(to_email: str, token: str):
    """
    Sends an email to the *new* email address with a confirm link.
    """
    FRONTEND_URL = _FRONTEND_URL_fallback()
    confirm_url = f"{FRONTEND_URL}/confirm-email-change?token={token}"
    subject = "📧 Confirm your SlotMe email change"
    body = f"""Hi there,

You requested to change your SlotMe login email.

🔗 Confirm this change:
{confirm_url}

⏰ This link will expire in 1 hour.

If you didn't request this email change, you can safely ignore this email.

— The SlotMe Team
https://slotme.xyz
"""
    send_branded_customer_reply(subject=subject, body=body, customer_email=to_email)
