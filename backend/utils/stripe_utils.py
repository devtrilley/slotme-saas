import stripe
import os
from typing import Optional

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Price ID to tier mapping for webhook tier assignment
PRICE_TO_TIER = {
    "price_1RaRhqE05eQPvycWs9mHnfIQ": "pro",  # Sandbox Pro price
    "price_1RaRi8E05eQPvycWOvwxPwpV": "elite",  # Sandbox Elite price
}


def cancel_subscription(subscription_id: str) -> stripe.Subscription:
    """
    Cancel a specific subscription by ID. Idempotent - handles already-canceled subs gracefully.

    Args:
        subscription_id: The Stripe subscription ID to cancel

    Returns:
        The canceled subscription object

    Raises:
        stripe.error.StripeError: If cancellation fails for non-idempotent reasons
    """
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)

        # If already canceled or incomplete, return as-is (idempotent)
        if subscription.status in ["canceled", "incomplete_expired"]:
            print(
                f"ℹ️  Subscription {subscription_id} already in terminal state: {subscription.status}"
            )
            return subscription

        # Cancel subscription at period end (user keeps access until billing cycle ends)
        canceled_sub = stripe.Subscription.modify(
            subscription_id, cancel_at_period_end=True
        )
        print(
            f"✅ Successfully scheduled cancellation for subscription {subscription_id} at period end"
        )

    except stripe.error.InvalidRequestError as e:
        # Handle "no such subscription" gracefully
        if "No such subscription" in str(e):
            print(
                f"ℹ️  Subscription {subscription_id} not found (may have been deleted)"
            )
            return None
        raise
    except stripe.error.StripeError as e:
        print(f"❌ Stripe error cancelling subscription {subscription_id}: {e}")
        raise


def get_active_subscription_for_customer(customer_id: str) -> Optional[str]:
    """
    Find the most recent active subscription ID for a customer.
    Useful for legacy accounts that don't have subscription_id stored.

    Args:
        customer_id: The Stripe customer ID

    Returns:
        Subscription ID if found, None otherwise
    """
    try:
        subscriptions = stripe.Subscription.list(
            customer=customer_id, status="active", limit=1
        )

        if subscriptions.data:
            sub_id = subscriptions.data[0].id
            print(f"🔍 Found active subscription {sub_id} for customer {customer_id}")
            return sub_id

        print(f"ℹ️  No active subscriptions found for customer {customer_id}")
        return None

    except stripe.error.StripeError as e:
        print(f"❌ Error fetching subscriptions for customer {customer_id}: {e}")
        return None


def cancel_freelancer_subscription(stripe_customer_id):
    """
    LEGACY: Cancel all active subscriptions for a Stripe customer at period end.
    Kept for backwards compatibility. New code should use cancel_subscription() directly.
    """
    try:
        subscriptions = stripe.Subscription.list(
            customer=stripe_customer_id, status="active"
        )

        canceled_count = 0
        for subscription in subscriptions.data:
            stripe.Subscription.modify(subscription.id, cancel_at_period_end=True)
            print(
                f"✅ Scheduled cancellation for subscription {subscription.id} at period end"
            )
            canceled_count += 1

        return canceled_count > 0

    except stripe.error.StripeError as e:
        print(f"❌ Stripe error cancelling subscription: {e}")
        raise
