# backend/routes/__init__.py

from flask import Blueprint
from .auth_routes import auth_bp
from .booking_routes import booking_bp
from .freelancer_routes import freelancer_bp
from .stripe_routes import stripe_bp
from .dev_routes import dev_bp
from .reminder_routes import reminder_bp

def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(booking_bp)
    app.register_blueprint(freelancer_bp)
    app.register_blueprint(stripe_bp)
    app.register_blueprint(dev_bp)
    app.register_blueprint(reminder_bp)