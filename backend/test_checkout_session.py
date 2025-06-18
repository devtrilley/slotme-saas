import stripe

stripe.api_key = "sk_test_51Ra2jlE05eQPvycW0HaTWlD6iKUYEiosXxZ3DL5lRrJG6eha1qLBbJZk0khHZOkBY7n61stBCbN9DcoXSchnGwoI00bs6MqYl4"

session = stripe.checkout.Session.create(
    payment_method_types=["card"],
    mode="subscription",
    line_items=[{
        "price": "price_1RaRi8E05eQPvycWOvwxPwpV",
        "quantity": 1,
    }],
    metadata={
        "freelancer_id": 1,
        "tier": "elite"
    },
    success_url="http://localhost:5173/upgrade-success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url="http://localhost:5173/upgrade-cancelled",
)

print("Test Stripe session created")
print("Visit this URL to test payment:")
print(session.url)
