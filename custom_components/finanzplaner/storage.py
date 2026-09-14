"""Versioned persistent data for Finanzplaner."""

from __future__ import annotations

from typing import Any

from homeassistant.helpers.storage import Store

from .const import DEFAULT_HOUSEHOLD_NAME, STORAGE_KEY, STORAGE_VERSION


def empty_data(household_name: str = DEFAULT_HOUSEHOLD_NAME) -> dict[str, Any]:
    return {
        "version": STORAGE_VERSION,
        "settings": {"household_name": household_name, "currency": "EUR"},
        "accounts": [],
        "plan_items": [],
        "bookings": [],
        "imports": [],
        "rules": [],
    }


class FinanceStore:
    """Small wrapper that keeps storage access in one place."""

    def __init__(self, hass: Any, household_name: str = DEFAULT_HOUSEHOLD_NAME) -> None:
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._household_name = household_name
        self.data: dict[str, Any] = empty_data(household_name)

    async def async_load(self) -> dict[str, Any]:
        stored = await self._store.async_load()
        if not stored:
            self.data = empty_data(self._household_name)
            return self.data
        self.data = {**empty_data(self._household_name), **stored}
        self.data["version"] = STORAGE_VERSION
        return self.data

    async def async_save(self) -> None:
        await self._store.async_save(self.data)
