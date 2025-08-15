# send_priority_support_ticket: Inbound from Elite freelancer → you
# send_branded_customer_reply: Outbound from you → any customer/freelancer
# send_feedback_submission: Inbound from public user → you

import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

load_dotenv()

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
    Sends the email verification link to the new freelancer (plain text).
    Frontend route expected to read ?token= and call /auth/verify-email (GET).
    """
    try:
        from config import FRONTEND_ORIGIN  # e.g., http://localhost:5173
    except Exception:
        FRONTEND_ORIGIN = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # 👇 Route name aligned with EmailConfirmed.jsx (cleaner than "signup-confirmed")
    verify_url = f"{FRONTEND_ORIGIN}/email-confirm?token={token}"

    subject = "Confirm your email for SlotMe"
    body = (
        "Welcome to SlotMe!\n\n"
        "Please confirm your email to finish setting up your account.\n\n"
        f"Verify your email: {verify_url}\n\n"
        "If you didn't request this, you can ignore this email."
    )

    # Reuse the SMTP helper
    send_branded_customer_reply(subject=subject, body=body, customer_email=to_email)
