"""Home Assistant sensors for the Finanzplaner overview."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.const import CURRENCY_EURO
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import FinanzplanerCoordinator
from .core import feed_profile_forecast


SENSORS = (
    ("planned_balance", "Geplanter Restbetrag", "€"),
    ("actual_balance", "Tatsächlicher Restbetrag", "€"),
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

    @property
    def native_value(self) -> float | int | str | None:
        if self._key == "next_feed_purchase":
            forecast = self._next_feed_forecast()
            return forecast.get("next_purchase_date") if forecast else None
        overview = self.coordinator.data.get("overview", {}) if self.coordinator.data else {}
        return overview.get(self._key, 0)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if self._key != "next_feed_purchase":
            return None
        forecast = self._next_feed_forecast()
        if not forecast:
            return None
        profile = forecast["profile"]
        values = forecast["values"]
        return {
            "status": values["status"],
            "pet_name": profile.get("pet_name"),
            "product": profile.get("product"),
            "expected_cost": profile.get("expected_cost"),
            "interval_weeks": values["effective_interval_weeks"],
            "interval_source": values["interval_source"],
            "days_until_purchase": values["days_until_purchase"],
        }

    def _next_feed_forecast(self) -> dict[str, Any] | None:
        data = self.coordinator.data or {}
        profiles = data.get("feed_profiles", [])
        if not isinstance(profiles, list):
            return None
        forecasts = []
        for profile in profiles:
            if not isinstance(profile, dict) or profile.get("active", True) is False:
                continue
            values = feed_profile_forecast(profile)
            next_date = values.get("next_purchase_date")
            if isinstance(next_date, str):
                forecasts.append({"profile": profile, "values": values})
        return min(
            forecasts,
            key=lambda item: item["values"]["next_purchase_date"],
        ) if forecasts else None
