"""Home Assistant sensors for the Finanzplaner overview."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.const import CURRENCY_EURO
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import FinanzplanerCoordinator
from .core import feed_profile_forecast


SENSORS = (
    ("planned_balance", "Geplanter Restbetrag", "€"),
    ("actual_balance", "Tatsächlicher Restbetrag", "€"),
    ("planned_income", "Geplante Einnahmen", "€"),
    ("planned_expenses", "Geplante Ausgaben", "€"),
    ("planned_savings", "Geplante Rücklagen", "€"),
    ("forecast", "Prognose", "€"),
    ("unresolved_amount", "Ungeklärter Betrag", "€"),
    ("household_balance", "Haushaltssaldo", "€"),
    ("next_major_payment", "Nächste größere Zahlung", ""),
    ("unresolved_bookings", "Ungeklärte Buchungen", ""),
    ("next_feed_purchase", "Nächster Futterkauf", ""),
)


async def async_setup_entry(hass: Any, entry: Any, async_add_entities: Any) -> None:
    coordinator: FinanzplanerCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        FinanceSensor(coordinator, entry.entry_id, key, name, unit)
        for key, name, unit in SENSORS
    )


class FinanceSensor(CoordinatorEntity[FinanzplanerCoordinator], SensorEntity):
    """Expose selected overview values without turning every booking into an entity."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: FinanzplanerCoordinator,
        entry_id: str,
        key: str,
        name: str,
        unit: str,
    ) -> None:
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_unique_id = f"{entry_id}_{key}"
        self._attr_native_unit_of_measurement = CURRENCY_EURO if unit == "€" else None
        if key == "next_major_payment":
            self._attr_device_class = SensorDeviceClass.DATE

    @property
    def native_value(self) -> float | int | str | None:
        if self._key == "next_feed_purchase":
            forecast = self._next_feed_forecast()
            return forecast.get("next_purchase_date") if forecast else None
        overview = self.coordinator.data.get("overview", {}) if self.coordinator.data else {}
        if self._key == "next_major_payment":
            return overview.get(self._key)
        if self._key == "unresolved_amount":
            return overview.get("unresolved_total", 0)
        return overview.get(self._key, 0)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if self._key != "next_feed_purchase":
            return None
        forecast = self._next_feed_forecast()
        forecasts = self._feed_forecasts()
        if not forecast:
            return {
                "active_profile_count": len(forecasts),
                "due_profile_count": 0,
                "profiles": [],
            }
        profile = forecast["profile"]
        values = forecast["values"]
        profiles = [
            {
                "id": item["profile"].get("id"),
                "pet_name": item["profile"].get("pet_name"),
                "product": item["profile"].get("product"),
                "next_purchase_date": item["values"].get("next_purchase_date"),
                "status": item["values"].get("status"),
                "days_until_purchase": item["values"].get("days_until_purchase"),
            }
            for item in forecasts
        ]
        due_profiles = [
            item for item in forecasts if item["values"].get("status") != "planned"
        ]
        return {
            "feed_profile_id": profile.get("id"),
            "status": values["status"],
            "pet_name": profile.get("pet_name"),
            "product": profile.get("product"),
            "expected_cost": profile.get("expected_cost"),
            "interval_weeks": values["effective_interval_weeks"],
            "interval_source": values["interval_source"],
            "days_until_purchase": values["days_until_purchase"],
            "active_profile_count": len(forecasts),
            "due_profile_count": len(due_profiles),
            "due_profile_ids": [item["profile"].get("id") for item in due_profiles],
            "profiles": profiles,
        }

    def _feed_forecasts(self) -> list[dict[str, Any]]:
        data = self.coordinator.data or {}
        profiles = data.get("feed_profiles", [])
        if not isinstance(profiles, list):
            return []
        return [
            {"profile": profile, "values": feed_profile_forecast(profile)}
            for profile in profiles
            if isinstance(profile, dict) and profile.get("active", True) is not False
        ]

    def _next_feed_forecast(self) -> dict[str, Any] | None:
        forecasts = [
            item
            for item in self._feed_forecasts()
            if isinstance(item["values"].get("next_purchase_date"), str)
        ]
        return min(
            forecasts,
            key=lambda item: item["values"]["next_purchase_date"],
        ) if forecasts else None
