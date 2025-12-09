import pytest
from models import ServiceAddon

class TestTierGating:
    """Test tier-based add-on limits"""
    
    def test_free_tier_blocked(self, client, auth_headers_free):
        """FREE tier cannot create add-ons"""
        response = client.post(
            '/freelancer/addons',
            headers=auth_headers_free,
            json={
                "name": "Should Fail",
                "price_usd": 10.00,
                "duration_minutes": 15
            }
        )
        assert response.status_code == 403
        data = response.get_json()
        assert "require PRO or ELITE" in data["error"]
        assert data["tier_required"] == "pro"
    
    def test_pro_tier_limit_5(self, client, auth_headers_pro, pro_freelancer, db_session):
        """PRO tier limited to 5 add-ons"""
        # Create 5 add-ons
        for i in range(5):
            addon = ServiceAddon(
                name=f"Addon {i}",
                price_usd=10.00,
                duration_minutes=15,
                freelancer_id=pro_freelancer.id
            )
            db_session.add(addon)
        db_session.commit()
        
        # Try to create 6th
        response = client.post(
            '/freelancer/addons',
            headers=auth_headers_pro,
            json={
                "name": "6th Addon",
                "price_usd": 10.00,
                "duration_minutes": 15
            }
        )
        assert response.status_code == 403
        data = response.get_json()
        assert "limited to 5" in data["error"]
        assert data["tier_required"] == "elite"
    
    def test_pro_tier_can_create_up_to_5(self, client, auth_headers_pro, pro_freelancer):
        """PRO tier can create 1-5 add-ons"""
        for i in range(5):
            response = client.post(
                '/freelancer/addons',
                headers=auth_headers_pro,
                json={
                    "name": f"Addon {i}",
                    "price_usd": 10.00,
                    "duration_minutes": 15
                }
            )
            assert response.status_code == 201
    
    def test_elite_tier_unlimited(self, client, auth_headers_elite, elite_freelancer):
        """ELITE tier has no limit"""
        for i in range(10):  # Create 10 add-ons
            response = client.post(
                '/freelancer/addons',
                headers=auth_headers_elite,
                json={
                    "name": f"Addon {i}",
                    "price_usd": 10.00,
                    "duration_minutes": 15
                }
            )
            assert response.status_code == 201