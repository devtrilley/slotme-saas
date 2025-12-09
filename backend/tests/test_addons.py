import pytest
import json
from models import ServiceAddon


class TestAddonCRUD:
    """Test add-on creation, reading, updating, deletion"""

    def test_create_addon_success(self, client, auth_headers_elite, elite_freelancer):
        """ELITE user can create add-on"""
        response = client.post(
            "/freelancer/addons",
            headers=auth_headers_elite,
            json={"name": "Test Addon", "price_usd": 10.00, "duration_minutes": 15},
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["name"] == "Test Addon"
        assert data["price_usd"] == 10.00
        assert data["duration_minutes"] == 15
        assert data["is_enabled"] is True

    def test_create_addon_price_only(self, client, auth_headers_elite):
        """Add-on with 0 duration (price-only)"""
        response = client.post(
            "/freelancer/addons",
            headers=auth_headers_elite,
            json={"name": "Tip Jar", "price_usd": 5.00, "duration_minutes": 0},
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["duration_minutes"] == 0

    def test_get_addons(self, client, auth_headers_elite, elite_freelancer, db_session):
        """Get all add-ons for freelancer"""
        # Create 3 add-ons
        for i in range(3):
            addon = ServiceAddon(
                name=f"Addon {i}",
                price_usd=float(i * 5),
                duration_minutes=10,
                freelancer_id=elite_freelancer.id,
            )
            db_session.add(addon)
        db_session.commit()

        response = client.get("/freelancer/addons", headers=auth_headers_elite)
        assert response.status_code == 200
        data = response.get_json()
        assert len(data) == 3

    def test_update_addon(
        self, client, auth_headers_elite, elite_freelancer, db_session
    ):
        """Update existing add-on"""
        addon = ServiceAddon(
            name="Original",
            price_usd=10.00,
            duration_minutes=15,
            freelancer_id=elite_freelancer.id,
        )
        db_session.add(addon)
        db_session.commit()

        response = client.patch(
            f"/freelancer/addons/{addon.id}",
            headers=auth_headers_elite,
            json={"name": "Updated", "price_usd": 20.00, "duration_minutes": 30},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["name"] == "Updated"
        assert data["price_usd"] == 20.00

    def test_toggle_addon(
        self, client, auth_headers_elite, elite_freelancer, db_session
    ):
        """Toggle add-on enabled/disabled"""
        addon = ServiceAddon(
            name="Toggle Test",
            price_usd=10.00,
            duration_minutes=15,
            freelancer_id=elite_freelancer.id,
            is_enabled=True,
        )
        db_session.add(addon)
        db_session.commit()

        # Disable
        response = client.patch(
            f"/freelancer/addons/{addon.id}",
            headers=auth_headers_elite,
            json={"is_enabled": False},
        )
        assert response.status_code == 200
        assert response.get_json()["is_enabled"] is False

        # Enable
        response = client.patch(
            f"/freelancer/addons/{addon.id}",
            headers=auth_headers_elite,
            json={"is_enabled": True},
        )
        assert response.status_code == 200
        assert response.get_json()["is_enabled"] is True

    def test_delete_addon(
        self, client, auth_headers_elite, elite_freelancer, db_session
    ):
        """Delete add-on"""
        addon = ServiceAddon(
            name="To Delete",
            price_usd=10.00,
            duration_minutes=15,
            freelancer_id=elite_freelancer.id,
        )
        db_session.add(addon)
        db_session.commit()
        addon_id = addon.id

        response = client.delete(
            f"/freelancer/addons/{addon_id}", headers=auth_headers_elite
        )
        assert response.status_code == 200

        # Verify deleted
        assert ServiceAddon.query.get(addon_id) is None
