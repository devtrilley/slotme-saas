from datetime import datetime


def has_paid_access(freelancer):
    """
    Check if freelancer has valid paid tier access.
    Returns True if they should have Pro/Elite features.
    """
    if not freelancer:
        return False

    # Free tier never has paid access
    if freelancer.tier == "free":
        return False

    # If no subscription, no access
    if not freelancer.stripe_subscription_id:
        return False

    # Check subscription status
    status = freelancer.subscription_status

    # Valid statuses that grant access
    valid_statuses = ["trialing", "active"]
    if status not in valid_statuses:
        return False

    # If subscription is cancelled but still in grace period
    if freelancer.cancel_at_period_end:
        now = datetime.utcnow()

        # During trial: check trial_end
        if status == "trialing" and freelancer.trial_end:
            return now < freelancer.trial_end

        # During paid period: check current_period_end
        if status == "active" and freelancer.current_period_end:
            return now < freelancer.current_period_end

    # If not cancelled and status is good, grant access
    return True


def get_effective_tier(freelancer):
    """
    Get the tier user should actually have based on subscription state.
    Returns: "free", "pro", or "elite"
    """
    if has_paid_access(freelancer):
        return freelancer.tier  # pro or elite
    return "free"
