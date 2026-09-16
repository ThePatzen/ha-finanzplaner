"""Home Assistant reminder state for planned feed purchases."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import FinanzplanerCoordinator
from .core import feed_profile_forecast


_REMINDER_STATUSES = frozenset({"due_soon", "due", "overdue"})


async def async_setup_entry(hass: Any, entry: Any, async_add_entities: Any) -> None:
    """Expose one aggregate reminder entity for all active feed profiles."""

    coordinator: FinanzplanerCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([FeedPurchaseDueSensor(coordinator, entry.entry_id)])


class FeedPurchaseDueSensor(CoordinatorEntity[FinanzplanerCoordinator], BinarySensorEntity):
    """Tell automations when any active feed profile needs attention."""

    _attr_has_entity_name = True
    _attr_name = "Futterkauf fällig"
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, coordinator: FinanzplanerCoordinator, entry_id: str) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry_id}_feed_purchase_due"

    @property
    def is_on(self) -> bool:
        return any(
            profile["forecast"].get("status") in _REMINDER_STATUSES
            for profile in self._profile_forecasts()
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        forecasts = self._profile_forecasts()
        due_profiles = [
            item for item in forecasts if item["forecast"].get("status") in _REMINDER_STATUSES
        ]
        next_item = min(
            forecasts,
            key=lambda item: item["forecast"].get("next_purchase_date") or "9999-12-31",
            default=None,
        )
        return {
            "active_profile_count": len(forecasts),
            "due_profile_count": len(due_profiles),
            "due_profile_ids": [item["profile"].get("id") for item in due_profiles],
            "due_profiles": [self._profile_payload(item) for item in due_profiles],
            "next_purchase_date": (
                next_item["forecast"].get("next_purchase_date") if next_item else None
            ),
        }

    def _profile_forecasts(self) -> list[dict[str, Any]]:
        data = self.coordinator.data or {}
        profiles = data.get("feed_profiles", [])
        if not isinstance(profiles, list):
            return []
        return [
            {"profile": profile, "forecast": feed_profile_forecast(profile)}
            for profile in profiles
            if isinstance(profile, dict) and profile.get("active", True) is not False
        ]

    @staticmethod
    def _profile_payload(item: dict[str, Any]) -> dict[str, Any]:
        profile = item["profile"]
        forecast = item["forecast"]
        return {
            "id": profile.get("id"),
            "pet_name": profile.get("pet_name"),
            "product": profile.get("product"),
            "next_purchase_date": forecast.get("next_purchase_date"),
            "status": forecast.get("status"),
            "days_until_purchase": forecast.get("days_until_purchase"),
            "expected_cost": profile.get("expected_cost"),
        }
