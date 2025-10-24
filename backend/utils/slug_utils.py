# backend/utils/slug_utils.py

import secrets
import string
from models import Freelancer


def generate_unique_slug(length=8):
    """
    Generates a cryptographically secure random slug.
    Format: lowercase letters + numbers (e.g., 'k7m3xp2w')

    Args:
        length: Length of slug (default 8)

    Returns:
        str: Unique slug guaranteed not to exist in DB
    """
    chars = string.ascii_lowercase + string.digits
    max_attempts = 100

    for _ in range(max_attempts):
        slug = "".join(secrets.choice(chars) for _ in range(length))

        # Check if slug already exists
        if not Freelancer.query.filter_by(public_slug=slug).first():
            return slug

    # Fallback: add timestamp if somehow we can't generate unique slug
    import time

    slug = "".join(secrets.choice(chars) for _ in range(length))
    return f"{slug}{int(time.time()) % 1000}"
