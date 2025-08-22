# backend/utils/features.py

FEATURES = {
    "custom_url": ["pro", "elite"],
    "csv_export": ["pro", "elite"],
    "analytics": ["pro", "elite"],
    "scan": ["elite"],
    "priority_support": ["elite"],
    # future: "email", "sms"
}


def normalize_tier(tier: str) -> str:
    return (tier or "free").strip().lower()


def allowed_tiers(feature: str):
    return FEATURES.get(feature, [])


def is_feature_enabled(feature: str, tier: str) -> bool:
    return normalize_tier(tier) in allowed_tiers(feature)


def all_features_for_tier(tier: str):
    t = normalize_tier(tier)
    return {name: (t in tiers) for name, tiers in FEATURES.items()}
