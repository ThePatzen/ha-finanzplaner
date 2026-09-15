"""Versioned persistent data for Finanzplaner."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .const import DEFAULT_HOUSEHOLD_NAME, STORAGE_KEY, STORAGE_VERSION
from .core import account_id_for_reference, normalize_account_reference


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


def migrate_store_data(
    stored: dict[str, object] | None, household_name: str
) -> dict[str, object]:
    """Migrate stored data to the current schema without persisting it."""

    data: dict[str, Any] = deepcopy(empty_data(household_name))
    if isinstance(stored, dict):
        data.update(deepcopy(stored))

    default_settings = empty_data(household_name)["settings"]
    settings = data.get("settings")
    data["settings"] = {
        **default_settings,
        **(settings if isinstance(settings, dict) else {}),
    }

    accounts = data.get("accounts")
    if not isinstance(accounts, list):
        accounts = []
        data["accounts"] = accounts
    account_by_reference: dict[str, dict[str, Any]] = {}
    for account in accounts:
        if not isinstance(account, dict):
            continue
        reference = normalize_account_reference(account.get("account_reference", ""))
        if reference:
            account["account_reference"] = reference
            account_by_reference.setdefault(reference, account)

    bookings = data.get("bookings")
    if not isinstance(bookings, list):
        bookings = []
        data["bookings"] = bookings
    for booking in bookings:
        if not isinstance(booking, dict):
            continue
        reference = normalize_account_reference(
            booking.get("account_reference", booking.get("account", ""))
        )
        booking["account_reference"] = reference
        booking["account_id"] = account_id_for_reference(reference)
        if "allocations" not in booking:
            booking["allocations"] = []
        if reference and reference not in account_by_reference:
            account = {
                "id": account_id_for_reference(reference),
                "label": f"Konto · {reference[-4:]}",
                "iban": None,
                "account_reference": reference,
                "currency": "EUR",
                "owner_targets": [],
                "active": True,
            }
            accounts.append(account)
            account_by_reference[reference] = account

    data["version"] = STORAGE_VERSION
    return data


class FinanceStore:
    """Small wrapper that keeps storage access in one place."""

    def __init__(self, hass: Any, household_name: str = DEFAULT_HOUSEHOLD_NAME) -> None:
        from homeassistant.helpers.storage import Store

        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._household_name = household_name
        self.data: dict[str, Any] = empty_data(household_name)

    async def async_load(self) -> dict[str, Any]:
        stored = await self._store.async_load()
        self.data = migrate_store_data(stored, self._household_name)
        return self.data

    async def async_save(self) -> None:
        await self._store.async_save(self.data)
