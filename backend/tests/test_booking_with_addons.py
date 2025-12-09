import pytest
import sys
import os
from datetime import datetime, timezone
import uuid

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app
from models import db, Freelancer, User, Service, TimeSlot, MasterTimeSlot, ServiceAddon

@pytest.fixture(scope='session')
def app():
    """Use existing Flask app with in-memory test database"""
    # Configure for testing
    flask_app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "WTF_CSRF_ENABLED": False,
        "JWT_SECRET_KEY": os.getenv("JWT_SECRET_KEY", "test-secret-key"),
    })
    
    with flask_app.app_context():
        db.create_all()
        yield flask_app
    
    # Cleanup after all tests
    with flask_app.app_context():
        db.session.remove()
        db.drop_all()

@pytest.fixture(scope='function')
def client(app):
    """Flask test client"""
    return app.test_client()

@pytest.fixture(scope='function', autouse=True)
def db_session(app):
    """Clean database for each test - auto-rollback"""
    with app.app_context():
        # Start a transaction
        connection = db.engine.connect()
        transaction = connection.begin()
        
        # Bind session to this transaction
        session = db.create_scoped_session(options={"bind": connection})
        db.session = session
        
        yield session
        
        # Rollback transaction after test
        transaction.rollback()
        connection.close()
        session.remove()

@pytest.fixture
def free_freelancer(app):
    """Create FREE tier freelancer with unique slug"""
    with app.app_context():
        freelancer = Freelancer(
            email=f"free-{uuid.uuid4().hex[:8]}@test.com",
            password="hashed",
            first_name="Free",
            last_name="User",
            business_name="Free Business",
            tier="free",
            public_slug=f"free-{uuid.uuid4().hex[:8]}",  # Unique slug
            timezone="America/New_York"
        )
        db.session.add(freelancer)
        db.session.commit()
        return freelancer

@pytest.fixture
def pro_freelancer(app):
    """Create PRO tier freelancer with unique slug"""
    with app.app_context():
        freelancer = Freelancer(
            email=f"pro-{uuid.uuid4().hex[:8]}@test.com",
            password="hashed",
            first_name="Pro",
            last_name="User",
            business_name="Pro Business",
            tier="pro",
            public_slug=f"pro-{uuid.uuid4().hex[:8]}",  # Unique slug
            timezone="America/New_York"
        )
        db.session.add(freelancer)
        db.session.commit()
        return freelancer

@pytest.fixture
def elite_freelancer(app):
    """Create ELITE tier freelancer with unique slug"""
    with app.app_context():
        freelancer = Freelancer(
            email=f"elite-{uuid.uuid4().hex[:8]}@test.com",
            password="hashed",
            first_name="Elite",
            last_name="User",
            business_name="Elite Business",
            tier="elite",
            public_slug=f"elite-{uuid.uuid4().hex[:8]}",  # Unique slug
            timezone="America/New_York"
        )
        db.session.add(freelancer)
        db.session.commit()
        return freelancer

@pytest.fixture
def test_service(app, elite_freelancer):
    """Create test service"""
    with app.app_context():
        service = Service(
            name="Test Cut",
            duration_minutes=30,
            price_usd=20.00,
            freelancer_id=elite_freelancer.id
        )
        db.session.add(service)
        db.session.commit()
        return service

@pytest.fixture
def master_times(app):
    """Create master time slots"""
    with app.app_context():
        times = []
        for hour in range(8, 18):  # 8 AM to 6 PM
            for minute in [0, 15, 30, 45]:
                time_str = f"{hour:02d}:{minute:02d}"
                label = datetime.strptime(time_str, "%H:%M").strftime("%I:%M %p").lstrip("0")
                
                # Check if already exists
                existing = MasterTimeSlot.query.filter_by(time_24h=time_str).first()
                if existing:
                    times.append(existing)
                else:
                    mt = MasterTimeSlot(time_24h=time_str, label=label)
                    db.session.add(mt)
                    times.append(mt)
        db.session.commit()
        return times

@pytest.fixture
def test_slots(app, elite_freelancer, master_times):
    """Create test time slots"""
    with app.app_context():
        slots = []
        for mt in master_times[:8]:  # 8 AM - 10 AM (2 hours)
            slot = TimeSlot(
                day="2025-12-10",
                master_time_id=mt.id,
                freelancer_id=elite_freelancer.id,
                timezone="America/New_York",
                is_booked=False
            )
            db.session.add(slot)
            slots.append(slot)
        db.session.commit()
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