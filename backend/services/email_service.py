def send_feedback_submission(to, subject, body):
    print(f"📬 Sending feedback to {to}:\nSubject: {subject}\n\n{body}")

def send_branded_customer_reply(subject, message, to_email):
    print(f"📬 Replying to customer {to_email}:\nSubject: {subject}\n\n{message}")