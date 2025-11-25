# routes/stripe_routes.py

from flask import Blueprint, request, jsonify
from models import db, Freelancer
from flask_jwt_extended import jwt_required, get_jwt_identity
import stripe, os
from config import FRONTEND_URL
import json


# stripe_bp = Blueprint("stripe", __name__)
stripe_bp = Blueprint("stripe", __name__, url_prefix="/stripe")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


@stripe_bp.route("/create-checkout-session", methods=["POST"])
@jwt_required()
def create_checkout_session():
    freelancer_id = int(get_jwt_identity())
    data = request.get_json()
    plan = data.get("plan")  # "pro" or "elite"

    if plan not in ["pro", "elite"]:
        return jsonify({"error": "Invalid plan"}), 400

    # Test Price Lookup
    # price_lookup = {
    #     "pro": "price_1RaRhqE05eQPvycWs9mHnfIQ",  # 🟪 from Doonga sandbox
    #     "elite": "price_1RaRi8E05eQPvycWOvwxPwpV",  # 🟪 from Doonga sandbox
    # }

    # REAL PRICE LOOKUP
    price_lookup = {
        # "pro": "price_1SX3uzCao129FRPLFDvvvRBZ",  # 🟪 LIVE - $0.01 (test price)
        # "elite": "price_1SX3zeCao129FRPLteY154eF",  # 🟪 LIVE - $0.02 (test price),
        "pro": "price_1Ra4Q7Cao129FRPLhW781Pum",  # 🟪 LIVE - $5 (real price)
        "elite": "price_1Ra4SSCao129FRPLofSSMdhl",  # 🟪 LIVE - $10 (real price),
    }

    try:
        freelancer = Freelancer.query.get(freelancer_id)

        # 🔥 If user has existing subscription, cancel it first
        if freelancer.stripe_subscription_id:
            print(f"🔴 Canceling old subscription {freelancer.stripe_subscription_id}")
            try:
                stripe.Subscription.delete(freelancer.stripe_subscription_id)
                print(f"✅ Old subscription canceled")
            except stripe.error.StripeError as e:
                print(f"⚠️ Error canceling old subscription: {e}")
                # Continue anyway - webhook will handle it

        # 🔥 ELSE: Create new subscription via Checkout (first time)
        success_url = data.get("success_url")
        if success_url:
            if "session_id=" not in success_url:
                if "?" in success_url:
                    success_url += "&session_id={CHECKOUT_SESSION_ID}"
                else:
                    success_url += "?session_id={CHECKOUT_SESSION_ID}"
        else:
            success_url = (
                f"{FRONTEND_URL}/upgrade-success?session_id={{CHECKOUT_SESSION_ID}}"
            )

        session = stripe.checkout.Session.create(
            **(
                {"customer": freelancer.stripe_customer_id}
                if freelancer.stripe_customer_id
                else {"customer_email": freelancer.email}
            ),
            success_url=success_url,
            cancel_url=f"{FRONTEND_URL}/upgrade-cancelled",
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_lookup[plan], "quantity": 1}],
            metadata={"freelancer_id": str(freelancer_id), "tier": plan},
        )
        return jsonify({"url": session.url})

    except Exception as e:
        print("❌ Stripe session error:", e)
        return jsonify({"error": "Failed to create checkout session"}), 500


@stripe_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    print("🔥 Stripe webhook route HIT")
    payload = request.data
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        if os.getenv("FLASK_ENV") == "development":
            event = json.loads(
                payload
            )  # 🔥 Bypass Stripe signature check for local testing
            print(f"📦 DEV MODE: Simulated event of type {event['type']}")
        else:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
            print(f"📦 Received Stripe event: {event['id']} of type {event['type']}")
    except Exception as e:
        print("❌ Error in webhook parsing:", e)
        return jsonify(success=False), 400

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        print("📗 Stripe checkout.session.completed received")

        metadata = session.get("metadata", {})
        freelancer_id = metadata.get("freelancer_id")
        requested_tier = metadata.get("tier")

        # Attempt to pull the actual line item to confirm price_id
        line_items = []
        try:
            line_items = stripe.checkout.Session.list_line_items(
                session["id"], limit=1
            ).data
        except Exception as e:
            print(f"⚠️ Could not fetch line items: {e}")

        # Map price_id → tier based on your real Stripe sandbox values
        price_map = {
            "price_1RaRhqE05eQPvycWs9mHnfIQ": "pro",
            "price_1RaRi8E05eQPvycWOvwxPwpV": "elite",
        }

        # Final tier from metadata (preferred) or fallback to price_id
        final_tier = requested_tier
        if not final_tier and line_items:
            price_id = line_items[0].price.id
            final_tier = price_map.get(price_id, "pro")

        # Find freelancer safely (prefer metadata, fallback to customer email)
        freelancer = None
        if freelancer_id:
            freelancer = Freelancer.query.get(int(freelancer_id))
        if not freelancer:
            customer_email = session.get("customer_email")
            if customer_email:
                freelancer = Freelancer.query.filter_by(email=customer_email).first()
                if freelancer:
                    print(f"⚠️ Matched freelancer by email {customer_email}")

        if not freelancer:
            print(f"❌ No matching freelancer found for session {session.get('id')}")
            return jsonify({"status": "ignored"}), 200

        # ✅ Update Stripe info
        customer_id = session.get("customer")
        if customer_id:
            freelancer.stripe_customer_id = customer_id

        subscription_id = session.get("subscription")
        if subscription_id:
            freelancer.stripe_subscription_id = subscription_id
            print(f"💾 Saved subscription_id: {subscription_id}")

        # ✅ Update tier and save
        freelancer.tier = final_tier
        db.session.commit()

        print(
            f"✅ Upgraded freelancer {freelancer.id} ({freelancer.email}) "
            f"to {final_tier.upper()} (price_id={line_items[0].price.id if line_items else 'N/A'})"
        )

    # ✅ Handle subscription cancellation events
    elif event["type"] in [
        "customer.subscription.deleted",
        "customer.subscription.canceled",
    ]:
        subscription = event["data"]["object"]
        subscription_id = subscription.get("id")
        customer_id = subscription.get("customer")

        print(
            f"🔴 Subscription {subscription_id} cancelled/deleted for customer {customer_id}"
        )

        # Find freelancer by subscription_id (preferred) or customer_id (fallback)
        freelancer = Freelancer.query.filter_by(
            stripe_subscription_id=subscription_id
        ).first()
        if not freelancer and customer_id:
            freelancer = Freelancer.query.filter_by(
                stripe_customer_id=customer_id
            ).first()

        if freelancer:
            # Downgrade to free tier and clear subscription_id
            freelancer.tier = "free"
            freelancer.stripe_subscription_id = None
            db.session.commit()
            print(
                f"✅ Downgraded freelancer {freelancer.id} to free tier (sub cancelled)"
            )
        else:
            print(f"⚠️  No freelancer found for subscription {subscription_id}")

    return jsonify(success=True), 200


@stripe_bp.route("/cancel-subscription", methods=["POST"])
@jwt_required()
def cancel_subscription():
    """Cancel user's subscription at end of billing period"""
    freelancer_id = int(get_jwt_identity())

    try:
        freelancer = Freelancer.query.get(freelancer_id)

        if not freelancer:
            return jsonify({"error": "Freelancer not found"}), 404

        if freelancer.tier == "free":
            return jsonify({"error": "No active subscription to cancel"}), 400

        if not freelancer.stripe_subscription_id:
            return jsonify({"error": "No subscription ID found"}), 400

        # Cancel at period end (user keeps access until billing cycle ends)
        subscription = stripe.Subscription.modify(
            freelancer.stripe_subscription_id, cancel_at_period_end=True
        )

        print(
            f"✅ Subscription {subscription.id} set to cancel at period end for freelancer {freelancer_id}"
        )

        return (
            jsonify({"message": "Subscription will cancel at end of billing period"}),
            200,
        )

    except stripe.error.StripeError as e:
        print(f"❌ Stripe error canceling subscription: {e}")
        return jsonify({"error": "Failed to cancel subscription"}), 500
    except Exception as e:
        print(f"❌ Error canceling subscription: {e}")
        return jsonify({"error": "Failed to cancel subscription"}), 500


@stripe_bp.route("/check-session-status/<session_id>", methods=["GET"])
def check_session_status(session_id):
    print("🚨 HIT check-session-status with no auth")
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        print(f"🔍 Checking session {session_id}...")

        metadata = session.get("metadata", {})
        freelancer_id = metadata.get("freelancer_id")

        if not freelancer_id:
            print("⚠️  Missing freelancer_id in session metadata")
            return jsonify({"error": "Missing freelancer ID"}), 400

        freelancer = Freelancer.query.get(int(freelancer_id))
        if not freelancer:
            print(f"❌ No freelancer found for ID {freelancer_id}")
            return jsonify({"error": "Freelancer not found"}), 404

        payment_status = session.get("payment_status")
        if payment_status != "paid":
            print(f"❌ Payment not completed. Status: {payment_status}")
            return jsonify({"error": "Payment not completed"}), 400

        # ✅ CRITICAL FIX: Issue BOTH tokens after successful payment verification
        # This allows users who took >15 min at Stripe to continue their session
        from flask_jwt_extended import create_access_token, create_refresh_token

        fresh_access_token = create_access_token(identity=str(freelancer.id))
        fresh_refresh_token = create_refresh_token(identity=str(freelancer.id))
        print(
            f"🔑 Issued fresh tokens for freelancer {freelancer.id} after payment verification"
        )

        return (
            jsonify(
                {
                    "tier": freelancer.tier,
                    "payment_status": payment_status,
                    "session_status": session.get("status"),
                    "access_token": fresh_access_token,  # ✅ Short-lived
                    "refresh_token": fresh_refresh_token,  # ✅ Long-lived (NEW)
                }
            ),
            200,
        )

    except Exception as e:
        print("❌ Failed to verify session:", e)
        return jsonify({"error": "Failed to verify session"}), 500
