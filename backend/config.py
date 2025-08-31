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

FRONTEND_ORIGIN = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Allow multiple dev/testing origins
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

# Optional: add frontend env if defined
if FRONTEND_ORIGIN not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append(FRONTEND_ORIGIN)

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
