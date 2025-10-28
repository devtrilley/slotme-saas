import os

from collections import defaultdict

name_pool = [
    ("Naomi", "Davis"),
    ("Ava", "Patel"),
    ("Jasmine", "Nguyen"),
    ("Lily", "Chen"),
    ("Amber", "Lee"),
    ("Maya", "Ali"),
    ("Zara", "Hassan"),
    ("Sasha", "Brown"),
    ("Tina", "Park"),
    ("Emily", "Wright"),
    ("Grace", "Lopez"),
    ("Olivia", "Smith"),
    ("Liam", "Johnson"),
    ("Noah", "Williams"),
    ("Elijah", "Rodriguez"),
    ("Aiden", "Chen"),
    ("Mateo", "Ramirez"),
    ("Ethan", "Hernandez"),
    ("Logan", "Nguyen"),
    ("Lucas", "Carter"),
    ("Jayden", "Kim"),
    ("Sebastian", "Singh"),
    ("Julian", "Wang"),
    ("Isaac", "Diaz"),
]

ip_attempts = defaultdict(list)  # Track booking timestamps by IP

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Allow multiple dev/testing origins
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

# Optional: add frontend env if defined
if FRONTEND_URL not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append(FRONTEND_URL)

# PRODUCTION ONLY: Lock down CORS in prod
if os.getenv("FLASK_ENV") == "production":
    prod_origin = os.getenv("FRONTEND_URL")
    if prod_origin:
        ALLOWED_ORIGINS = [prod_origin]

BACKEND_ORIGIN = os.getenv("BACKEND_ORIGIN", "http://127.0.0.1:5000")

RESERVED_ROUTES = {
    "404",
    "slots",
    "book",
    "auth",
    "seed",
    "verify",
    "master-times",
    "freelancer",
    "freelancers",
    "dev",
}

# JWT Configuration
JWT_ACCESS_TOKEN_EXPIRES = 900  # 15 minutes (900 seconds)
JWT_REFRESH_TOKEN_EXPIRES = 604800  # 7 days
