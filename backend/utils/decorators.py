# backend/utils/decorators.py
from functools import wraps
from flask import g, jsonify
from utils.features import FEATURES, is_feature_enabled, normalize_tier


def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        from flask import request

        # ✅ allow browser preflight requests through untouched
        if request.method == "OPTIONS":
            return ("", 200)

        # assumes middleware set g.user and g.freelancer
        if not getattr(g, "user", None) or not getattr(g, "freelancer", None):
            return jsonify({"error": "auth_required"}), 401

        return f(*args, **kwargs)

    return wrapper


def require_tier(*args):
    """
    Usage:
      @require_tier("custom_url")            # gate by feature key from FEATURES
      @require_tier("pro", "elite")          # gate by explicit tiers

    On failure → 403 JSON:
      {"error":"upgrade_required","feature":"<feature or null>","required_tiers":[...]}
    """
    if not args:
        raise RuntimeError("require_tier needs at least one argument")

    # If first arg matches a known feature, gate by feature
    feature = args[0] if args[0] in FEATURES else None
    required_tiers = FEATURES[feature] if feature else [a.lower() for a in args]

    def decorator(fn):
        @wraps(fn)
        def wrapper(*w_args, **w_kwargs):
            user = getattr(g, "user", None) or {}
            tier = normalize_tier(user.get("tier") or user.get("plan") or "free")

            ok = (
                is_feature_enabled(feature, tier)
                if feature
                else (tier in required_tiers)
            )
            if not ok:
                return (
                    jsonify(
                        {
                            "error": "upgrade_required",
                            "feature": feature,
                            "required_tiers": required_tiers,
                        }
                    ),
                    403,
                )
            return fn(*w_args, **w_kwargs)

        return wrapper

    return decorator
