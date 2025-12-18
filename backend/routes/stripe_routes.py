# routes/stripe_routes.py

from flask import Blueprint, request, jsonify
from models import db, Freelancer
from flask_jwt_extended import jwt_required, get_jwt_identity
import stripe, os
from config import FRONTEND_URL
import json
from datetime import datetime


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
            subscription_data={
                "trial_period_days": 30,  # 🎁 30-day free trial
            },
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
            event = json.loads(payload)
            print(f"📦 DEV MODE: Simulated event of type {event['type']}")
        else:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
            print(f"📦 Received Stripe event: {event['id']} of type {event['type']}")
    except Exception as e:
        print("❌ Error in webhook parsing:", e)
        return jsonify(success=False), 400

    # 🔥 PRICE ID → TIER MAPPING (LIVE PRICES ONLY)
    PRICE_TO_TIER = {
        "price_1Ra4Q7Cao129FRPLhW781Pum": "pro",  # $5/mo
        "price_1Ra4SSCao129FRPLofSSMdhl": "elite",  # $10/mo
    }

    # ==================== EVENT 1: CHECKOUT COMPLETED ====================
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        print("📗 checkout.session.completed")

        # Get freelancer
        freelancer_id = session.get("metadata", {}).get("freelancer_id")
        freelancer = None

        if freelancer_id:
            freelancer = Freelancer.query.get(int(freelancer_id))

        if not freelancer:
            customer_email = session.get("customer_email")
            if customer_email:
                freelancer = Freelancer.query.filter_by(email=customer_email).first()

        if not freelancer:
            print(f"❌ No freelancer found for session {session.get('id')}")
            return jsonify({"status": "ignored"}), 200

        # Get subscription details
        subscription_id = session.get("subscription")
        customer_id = session.get("customer")

        if subscription_id:
            # Fetch full subscription object from Stripe
            try:
                sub = stripe.Subscription.retrieve(subscription_id)

                # Extract price_id from subscription items
                price_id = (
                    sub["items"]["data"][0]["price"]["id"] if sub.get("items") else None
                )
                tier = PRICE_TO_TIER.get(
                    price_id, "pro"
                )  # Default to pro if price not found

                # Save full subscription state
                freelancer.stripe_customer_id = customer_id
                freelancer.stripe_subscription_id = subscription_id
                freelancer.stripe_price_id = price_id
                freelancer.subscription_status = sub.get(
                    "status"
                )  # trialing, active, etc
                freelancer.cancel_at_period_end = sub.get("cancel_at_period_end", False)
                freelancer.current_period_end = (
                    datetime.fromtimestamp(sub["current_period_end"])
                    if sub.get("current_period_end")
                    else None
                )
                freelancer.trial_end = (
                    datetime.fromtimestamp(sub["trial_end"])
                    if sub.get("trial_end")
                    else None
                )
                freelancer.tier = tier

                db.session.commit()

                print(f"✅ Freelancer {freelancer.id} upgraded to {tier.upper()}")
                print(
                    f"   Status: {sub.get('status')}, Trial end: {freelancer.trial_end}"
                )

            except Exception as e:
                print(f"❌ Error fetching subscription: {e}")
                return jsonify({"status": "error"}), 500

    # ==================== EVENT 2: SUBSCRIPTION UPDATED ====================
    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        subscription_id = sub.get("id")

        print(f"🔄 subscription.updated: {subscription_id}")

        freelancer = Freelancer.query.filter_by(
            stripe_subscription_id=subscription_id
        ).first()

        if not freelancer:
            print(f"⚠️ No freelancer found for subscription {subscription_id}")
            return jsonify({"status": "ignored"}), 200

        # Extract current state
        status = sub.get("status")
        price_id = sub["items"]["data"][0]["price"]["id"] if sub.get("items") else None
        tier = PRICE_TO_TIER.get(price_id, freelancer.tier)  # Fallback to current tier

        # Update all subscription fields
        freelancer.subscription_status = status
        freelancer.stripe_price_id = price_id
        freelancer.cancel_at_period_end = sub.get("cancel_at_period_end", False)
        freelancer.current_period_end = (
            datetime.fromtimestamp(sub["current_period_end"])
            if sub.get("current_period_end")
            else None
        )
        freelancer.trial_end = (
            datetime.fromtimestamp(sub["trial_end"]) if sub.get("trial_end") else None
        )

        # 🔥 TIER LOGIC: Only give access if status is good
        if status in ["trialing", "active"]:
            freelancer.tier = tier
            print(
                f"✅ Freelancer {freelancer.id} tier set to {tier} (status: {status})"
            )
        elif status in ["past_due", "unpaid", "incomplete", "incomplete_expired"]:
            # Downgrade immediately on bad status
            freelancer.tier = "free"
            print(f"⚠️ Freelancer {freelancer.id} downgraded to free (status: {status})")

        db.session.commit()

    # ==================== EVENT 3: PAYMENT FAILED ====================
    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        subscription_id = invoice.get("subscription")

        print(f"💳 payment_failed for subscription {subscription_id}")

        freelancer = Freelancer.query.filter_by(
            stripe_subscription_id=subscription_id
        ).first()

        if not freelancer:
            print(f"⚠️ No freelancer found for subscription {subscription_id}")
            return jsonify({"status": "ignored"}), 200

        # Immediate downgrade on failed payment
        freelancer.tier = "free"
        freelancer.subscription_status = "past_due"

        db.session.commit()
        print(f"⚠️ Freelancer {freelancer.id} downgraded to free (payment failed)")

    # ==================== EVENT 4: PAYMENT SUCCEEDED ====================
    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        subscription_id = invoice.get("subscription")

        print(f"✅ payment_succeeded for subscription {subscription_id}")

        freelancer = Freelancer.query.filter_by(
            stripe_subscription_id=subscription_id
        ).first()

        if not freelancer:
            print(f"⚠️ No freelancer found for subscription {subscription_id}")
            return jsonify({"status": "ignored"}), 200

        # Restore access after successful payment
        try:
            sub = stripe.Subscription.retrieve(subscription_id)
            price_id = (
                sub["items"]["data"][0]["price"]["id"] if sub.get("items") else None
            )
            tier = PRICE_TO_TIER.get(price_id, "pro")

            freelancer.tier = tier
            freelancer.subscription_status = sub.get("status", "active")
            freelancer.current_period_end = (
                datetime.fromtimestamp(sub["current_period_end"])
                if sub.get("current_period_end")
                else None
            )

            db.session.commit()
            print(
                f"✅ Freelancer {freelancer.id} restored to {tier} (payment succeeded)"
            )

        except Exception as e:
            print(f"❌ Error restoring access: {e}")

    # ==================== EVENT 5: SUBSCRIPTION DELETED ====================
    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        subscription_id = sub.get("id")

        print(f"🔴 subscription.deleted: {subscription_id}")

        freelancer = Freelancer.query.filter_by(
            stripe_subscription_id=subscription_id
        ).first()

        if not freelancer:
            print(f"⚠️ No freelancer found for subscription {subscription_id}")
            return jsonify({"status": "ignored"}), 200

        # Full cleanup on deletion
        freelancer.tier = "free"
        freelancer.stripe_subscription_id = None
        freelancer.stripe_price_id = None
        freelancer.subscription_status = None
        freelancer.cancel_at_period_end = False
        freelancer.current_period_end = None
        freelancer.trial_end = None

        db.session.commit()
        print(
            f"✅ Freelancer {freelancer.id} downgraded to free (subscription deleted)"
        )

    return jsonify(success=True), 200


@stripe_bp.route("/cancel-subscription", methods=["POST"])
@jwt_required()
def cancel_subscription():
    """Cancel user's subscription at end of billing period (or trial)"""
    freelancer_id = int(get_jwt_identity())
    
    try:
        freelancer = Freelancer.query.get(freelancer_id)
        if not freelancer:
            return jsonify({"error": "Freelancer not found"}), 404

        if freelancer.tier == "free":
            return jsonify({"error": "No active subscription to cancel"}), 400

        if not freelancer.stripe_subscription_id:
            return jsonify({"error": "No subscription ID found"}), 400

        # Cancel at period end (keeps access until trial_end or current_period_end)
        subscription = stripe.Subscription.modify(
            freelancer.stripe_subscription_id, 
            cancel_at_period_end=True
        )

        # Update local state
        freelancer.cancel_at_period_end = True
        db.session.commit()

        # Determine when access ends
        end_date = None
        if freelancer.subscription_status == "trialing" and freelancer.trial_end:
            end_date = freelancer.trial_end
            message = f"Your trial will end on {freelancer.trial_end.strftime('%B %d, %Y')}. You won't be charged."
        elif freelancer.current_period_end:
            end_date = freelancer.current_period_end
            message = f"Your subscription will end on {freelancer.current_period_end.strftime('%B %d, %Y')}."
        else:
            message = "Subscription will cancel at the end of the current period."

        print(f"✅ Subscription {subscription.id} set to cancel at period end for freelancer {freelancer_id}")

        return jsonify({
            "message": message,
            "ends_at": end_date.isoformat() if end_date else None
        }), 200

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

@stripe_bp.route("/sync-subscription", methods=["GET"])
@jwt_required()
def sync_subscription():
    """Manually sync subscription state from Stripe (failsafe for missed webhooks)"""
    freelancer_id = int(get_jwt_identity())
    
    try:
        freelancer = Freelancer.query.get(freelancer_id)
        if not freelancer:
            return jsonify({"error": "Freelancer not found"}), 404

        if not freelancer.stripe_subscription_id:
            return jsonify({
                "tier": "free",
                "status": "no_subscription",
                "message": "No active subscription"
            }), 200

        # Fetch subscription from Stripe
        sub = stripe.Subscription.retrieve(freelancer.stripe_subscription_id)
        
        # Map price_id to tier
        PRICE_TO_TIER = {
            "price_1Ra4Q7Cao129FRPLhW781Pum": "pro",
            "price_1Ra4SSCao129FRPLofSSMdhl": "elite",
        }
        
        price_id = sub["items"]["data"][0]["price"]["id"] if sub.get("items") else None
        tier = PRICE_TO_TIER.get(price_id, "pro")
        status = sub.get("status")

        # Update DB with fresh Stripe data
        freelancer.stripe_price_id = price_id
        freelancer.subscription_status = status
        freelancer.cancel_at_period_end = sub.get("cancel_at_period_end", False)
        freelancer.current_period_end = datetime.fromtimestamp(sub["current_period_end"]) if sub.get("current_period_end") else None
        freelancer.trial_end = datetime.fromtimestamp(sub["trial_end"]) if sub.get("trial_end") else None

        # Set tier based on status
        if status in ["trialing", "active"]:
            freelancer.tier = tier
        else:
            freelancer.tier = "free"

        db.session.commit()

        print(f"🔄 Synced subscription for freelancer {freelancer_id}: {status} -> {freelancer.tier}")

        return jsonify({
            "tier": freelancer.tier,
            "status": status,
            "cancel_at_period_end": freelancer.cancel_at_period_end,
            "current_period_end": freelancer.current_period_end.isoformat() if freelancer.current_period_end else None,
            "trial_end": freelancer.trial_end.isoformat() if freelancer.trial_end else None,
        }), 200

    except stripe.error.StripeError as e:
        print(f"❌ Stripe error syncing subscription: {e}")
        return jsonify({"error": "Failed to sync subscription"}), 500
    except Exception as e:
        print(f"❌ Error syncing subscription: {e}")
        return jsonify({"error": "Failed to sync subscription"}), 500