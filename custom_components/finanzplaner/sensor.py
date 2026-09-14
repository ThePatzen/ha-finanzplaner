"""Home Assistant sensors for the Finanzplaner overview."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.const import CURRENCY_EURO
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import FinanzplanerCoordinator


SENSORS = (
    ("planned_balance", "Geplanter Restbetrag", "€"),
    ("actual_balance", "Tatsächlicher Restbetrag", "€"),
    ("unresolved_bookings", "Ungeklärte Buchungen", ""),
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
    def native_value(self) -> float | int:
        overview = self.coordinator.data.get("overview", {}) if self.coordinator.data else {}
        return overview.get(self._key, 0)
