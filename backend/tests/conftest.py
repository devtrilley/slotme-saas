import pytest
import sys
import os
from datetime import datetime, timezone

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app as flask_app
from models import db, Freelancer, User, Service, TimeSlot, MasterTimeSlot, ServiceAddon


@pytest.fixture(scope="session")
def app():
    """Use existing Flask app with in-memory test database"""
    # Save original config
    original_db = flask_app.config.get("SQLALCHEMY_DATABASE_URI")

    # Configure for testing
    flask_app.config.update(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",  # In-memory test DB
            "WTF_CSRF_ENABLED": False,
            "JWT_SECRET_KEY": os.getenv("JWT_SECRET_KEY", "test-secret-key"),
        }
    )

    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()

    # Restore original config
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = original_db


@pytest.fixture(scope="function")
def client(app):
    """Flask test client"""
    return app.test_client()


@pytest.fixture(scope="function")
def runner(app):
    """Flask CLI runner"""
    return app.test_cli_runner()


@pytest.fixture(scope="function")
def db_session(app):
    """Clean database session for each test"""
    with app.app_context():
        db.session.begin_nested()
        yield db.session
        db.session.rollback()


import uuid  # Add at top of file


@pytest.fixture
def free_freelancer(app):
    """Create FREE tier freelancer"""
    with app.app_context():
        freelancer = Freelancer(
            email=f"free-{uuid.uuid4().hex[:8]}@test.com",
            password="hashed",
            first_name="Free",
            last_name="User",
            business_name="Free Business",
            tier="free",
            public_slug=f"free-{uuid.uuid4().hex[:8]}",
            timezone="America/New_York",
        )
        db.session.add(freelancer)
        db.session.commit()
        db.session.refresh(freelancer)  # ← ADD THIS LINE
        return freelancer


@pytest.fixture
def pro_freelancer(app):
    """Create PRO tier freelancer"""
    with app.app_context():
        freelancer = Freelancer(
            email=f"pro-{uuid.uuid4().hex[:8]}@test.com",
            password="hashed",
            first_name="Pro",
            last_name="User",
            business_name="Pro Business",
            tier="pro",
            public_slug=f"pro-{uuid.uuid4().hex[:8]}",
            timezone="America/New_York",
        )
        db.session.add(freelancer)
        db.session.commit()
        db.session.refresh(freelancer)
        return freelancer


@pytest.fixture
def elite_freelancer(app):
    """Create ELITE tier freelancer"""
    with app.app_context():
        freelancer = Freelancer(
            email=f"elite-{uuid.uuid4().hex[:8]}@test.com",
            password="hashed",
            first_name="Elite",
            last_name="User",
            business_name="Elite Business",
            tier="elite",
            public_slug=f"elite-{uuid.uuid4().hex[:8]}",
            timezone="America/New_York",
        )
        db.session.add(freelancer)
        db.session.commit()
        db.session.refresh(freelancer)
        return freelancer


@pytest.fixture
def test_service(db_session, elite_freelancer):
    """Create test service"""
    service = Service(
        name="Test Cut",
        duration_minutes=30,
        price_usd=20.00,
        freelancer_id=elite_freelancer.id,
    )
    db_session.add(service)
    db_session.commit()
    return service


@pytest.fixture
def master_times(db_session):
    """Create master time slots"""
    times = []
    for hour in range(8, 18):  # 8 AM to 6 PM
        for minute in [0, 15, 30, 45]:
            time_str = f"{hour:02d}:{minute:02d}"
            label = (
                datetime.strptime(time_str, "%H:%M").strftime("%I:%M %p").lstrip("0")
            )
            mt = MasterTimeSlot(time_24h=time_str, label=label)
            db_session.add(mt)
            times.append(mt)
    db_session.commit()
    return times


@pytest.fixture
def test_slots(db_session, elite_freelancer, master_times):
    """Create test time slots"""
    slots = []
    for mt in master_times[:8]:  # 8 AM - 10 AM (2 hours)
        slot = TimeSlot(
            day="2025-12-10",
            master_time_id=mt.id,
            freelancer_id=elite_freelancer.id,
            timezone="America/New_York",
            is_booked=False,
        )
        db_session.add(slot)
        slots.append(slot)
    db_session.commit()
    return slots


@pytest.fixture
def auth_headers_free(app, free_freelancer):
    """Get JWT auth headers for FREE user"""
    with app.app_context():
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(free_freelancer.id))
        return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers_pro(app, pro_freelancer):
    """Get JWT auth headers for PRO user"""
    with app.app_context():
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(pro_freelancer.id))
        return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers_elite(app, elite_freelancer):
    """Get JWT auth headers for ELITE user"""
    with app.app_context():
        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=str(elite_freelancer.id))
        return {"Authorization": f"Bearer {token}"}
