"""Versioned persistent data for Finanzplaner."""

from __future__ import annotations

from copy import deepcopy
from datetime import date
import hashlib
from typing import Any

from .const import DEFAULT_HOUSEHOLD_NAME, STORAGE_KEY, STORAGE_VERSION
from .core import account_id_for_reference, normalize_account_reference


def empty_data(household_name: str = DEFAULT_HOUSEHOLD_NAME) -> dict[str, Any]:
    return {
        "version": STORAGE_VERSION,
        "settings": {"household_name": household_name, "currency": "EUR"},
        "accounts": [],
        "pets": [],
        "feed_profiles": [],
        "plan_items": [],
        "bookings": [],
        "imports": [],
        "rules": [],
    }


def _normalize_pets(data: dict[str, Any]) -> None:
    """Add stable IDs and safe defaults to locally managed pet profiles."""

    pets = data.get("pets")
    if not isinstance(pets, list):
        data["pets"] = []
        return
    used_ids: set[str] = set()
    for index, pet in enumerate(pets):
        if not isinstance(pet, dict):
            continue
        name = str(pet.get("name", "")).strip()
        pet["name"] = name
        pet_type = pet.get("pet_type")
        pet["pet_type"] = pet_type.strip() if isinstance(pet_type, str) and pet_type.strip() else None
        pet_id = pet.get("id")
        if not isinstance(pet_id, str) or not pet_id.strip() or pet_id in used_ids:
            material = "|".join((str(index), name, str(pet.get("pet_type") or "")))
            pet_id = f"pet-{hashlib.sha256(material.encode('utf-8')).hexdigest()[:16]}"
        pet["id"] = pet_id.strip()
        used_ids.add(pet["id"])
        pet.setdefault("active", True)
        pet.setdefault("created_at", None)
        pet.setdefault("updated_at", None)


def _pet_by_id(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    pets = data.get("pets", [])
    return {
        pet["id"]: pet
        for pet in pets
        if isinstance(pet, dict) and isinstance(pet.get("id"), str)
    }


def _normalize_feed_profiles(
    data: dict[str, Any], pets: dict[str, dict[str, Any]] | None = None
) -> None:
    """Normalize feed profiles while keeping their purchase history local."""

    profiles = data.get("feed_profiles")
    if not isinstance(profiles, list):
        data["feed_profiles"] = []
        return
    used_ids: set[str] = set()
    for index, profile in enumerate(profiles):
        if not isinstance(profile, dict):
            continue
        pet_id = profile.get("pet_id")
        profile["pet_id"] = pet_id.strip() if isinstance(pet_id, str) and pet_id.strip() else None
        profile["product"] = str(profile.get("product", "")).strip()
        profile["package_unit"] = str(profile.get("package_unit", "")).strip()
        profile_id = profile.get("id")
        if not isinstance(profile_id, str) or not profile_id.strip() or profile_id in used_ids:
            material = "|".join(
                (
                    str(index),
                    str(profile.get("pet_id") or ""),
                    profile["product"],
                    profile["package_unit"],
                )
            )
            profile_id = f"feed-profile-{hashlib.sha256(material.encode('utf-8')).hexdigest()[:16]}"
        profile["id"] = profile_id.strip()
        used_ids.add(profile["id"])

        interval = profile.get("interval_weeks")
        if isinstance(interval, bool):
            interval = None
        elif isinstance(interval, (int, float)) and 0 < interval <= 520:
            interval = round(float(interval), 2)
        else:
            interval = None
        profile["interval_weeks"] = interval

        last_purchase = profile.get("last_purchase_date")
        if not isinstance(last_purchase, str):
            last_purchase = None
        else:
            try:
                last_purchase = date.fromisoformat(last_purchase).isoformat()
            except ValueError:
                last_purchase = None
        history = profile.get("purchase_dates", [])
        clean_history: set[str] = set()
        if isinstance(history, list):
            for value in history:
                if not isinstance(value, str):
                    continue
                try:
                    clean_history.add(date.fromisoformat(value).isoformat())
                except ValueError:
                    continue
        if last_purchase:
            clean_history.add(last_purchase)
        profile["purchase_dates"] = sorted(clean_history)
        profile["last_purchase_date"] = profile["purchase_dates"][-1] if clean_history else None

        due_soon_days = profile.get("due_soon_days", 14)
        if isinstance(due_soon_days, bool) or not isinstance(due_soon_days, int) or not 0 <= due_soon_days <= 90:
            due_soon_days = 14
        profile["due_soon_days"] = due_soon_days
        profile["active"] = profile.get("active", True) is not False
        profile.setdefault("expected_cost", 0.0)
        profile.setdefault("created_at", None)
        profile.setdefault("updated_at", None)

        pet = pets.get(profile["pet_id"]) if pets and profile.get("pet_id") else None
        if pet is not None:
            if not profile.get("pet_name"):
                profile["pet_name"] = pet.get("name")
            if not profile.get("pet_type"):
                profile["pet_type"] = pet.get("pet_type")
        profile.setdefault("pet_name", None)
        profile.setdefault("pet_type", None)


def _normalize_plan_items(
    data: dict[str, Any], pets: dict[str, dict[str, Any]] | None = None
) -> None:
    """Add non-destructive defaults needed by the plan-item editor."""

    plan_items = data.get("plan_items")
    if not isinstance(plan_items, list):
        data["plan_items"] = []
        return
    for index, item in enumerate(plan_items):
        if not isinstance(item, dict):
            continue
        if not item.get("id"):
            material = "|".join(
                (
                    str(index),
                    str(item.get("name", "")),
                    str(item.get("direction", "")),
                    str(item.get("amount", "")),
                )
            )
            item["id"] = f"plan-item-{hashlib.sha256(material.encode('utf-8')).hexdigest()[:16]}"
        item.setdefault("active", True)
        item.setdefault("remaining_amount", item.get("amount", 0))
        item.setdefault("frequency_months", 1)
        item.setdefault("category", None)
        item.setdefault("area", None)
        item.setdefault("project", None)
        item.setdefault("target", None)
        item.setdefault("due_day", None)
        item.setdefault("due_date", None)
        item.setdefault("start_date", None)
        item.setdefault("end_date", None)
        item.setdefault("pet_id", None)
        item.setdefault("pet_name", None)
        item.setdefault("pet_type", None)
        pet_id = item.get("pet_id")
        pet = pets.get(pet_id) if pets and isinstance(pet_id, str) else None
        if pet is not None:
            if not item.get("pet_name"):
                item["pet_name"] = pet.get("name")
            if not item.get("pet_type"):
                item["pet_type"] = pet.get("pet_type")


def _normalize_booking_allocations(
    data: dict[str, Any], pets: dict[str, dict[str, Any]] | None = None
) -> None:
    bookings = data.get("bookings")
    if not isinstance(bookings, list):
        return
    for booking in bookings:
        if not isinstance(booking, dict):
            continue
        allocations = booking.get("allocations")
        if not isinstance(allocations, list):
            booking["allocations"] = []
            continue
        for allocation in allocations:
            if not isinstance(allocation, dict):
                continue
            allocation.setdefault("pet_id", None)
            allocation.setdefault("pet_name", None)
            allocation.setdefault("pet_type", None)
            pet_id = allocation.get("pet_id")
            pet = pets.get(pet_id) if pets and isinstance(pet_id, str) else None
            if pet is not None:
                if not allocation.get("pet_name"):
                    allocation["pet_name"] = pet.get("name")
                if not allocation.get("pet_type"):
                    allocation["pet_type"] = pet.get("pet_type")


def migrate_store_data(
    stored: dict[str, object] | None, household_name: str
) -> dict[str, object]:
    """Migrate version-one data to the current schema without persisting it."""

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
            account["id"] = account.get("id") or account_id_for_reference(reference)
            account.setdefault("bank", None)
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
        account = account_by_reference.get(reference)
        booking["account_id"] = (
            account["id"] if account is not None else account_id_for_reference(reference)
        )
        if "allocations" not in booking:
            booking["allocations"] = []
        if reference and reference not in account_by_reference:
            account = {
                "id": account_id_for_reference(reference),
                "label": f"Konto · {reference[-4:]}",
                "iban": None,
                "account_reference": reference,
                "bank": None,
                "currency": "EUR",
                "owner_targets": [],
                "active": True,
            }
            accounts.append(account)
            account_by_reference[reference] = account

    data["version"] = STORAGE_VERSION
    _normalize_pets(data)
    pets = _pet_by_id(data)
    _normalize_feed_profiles(data, pets)
    _normalize_plan_items(data, pets)
    _normalize_booking_allocations(data, pets)
    return data


def normalize_current_store_data(
    stored: dict[str, object] | None, household_name: str
) -> dict[str, object]:
    """Fill safe defaults in current data while preserving configured links."""

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
            account["id"] = account.get("id") or account_id_for_reference(reference)
            account.setdefault("owner_targets", [])
            account.setdefault("active", True)
            account.setdefault("currency", "EUR")
            account.setdefault("bank", None)
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
        # A v2 account_id is an explicit historical link. Never recompute it
        # from a later import's account reference during a normal load.
        if "account_id" not in booking:
            account = account_by_reference.get(reference)
            booking["account_id"] = account.get("id") if account else None
        booking.setdefault("allocations", [])

    data["version"] = STORAGE_VERSION
    _normalize_pets(data)
    pets = _pet_by_id(data)
    _normalize_feed_profiles(data, pets)
    _normalize_plan_items(data, pets)
    _normalize_booking_allocations(data, pets)
    return data


class FinanceStore:
    """Small wrapper that keeps storage access in one place."""

    def __init__(self, hass: Any, household_name: str = DEFAULT_HOUSEHOLD_NAME) -> None:
        from homeassistant.helpers.storage import Store

        class MigratingStore(Store):
            async def _async_migrate_func(
                self,
                old_major_version: int,
                old_minor_version: int,
                old_data: dict[str, object],
            ) -> dict[str, object]:
                if old_major_version != 1:
                    raise NotImplementedError(
                        f"Unsupported store major version: {old_major_version}"
                    )
                return migrate_store_data(old_data, household_name)

        self._store = MigratingStore(hass, STORAGE_VERSION, STORAGE_KEY)
        self._household_name = household_name
        self.data: dict[str, Any] = empty_data(household_name)

    async def async_load(self) -> dict[str, Any]:
        stored = await self._store.async_load()
        version = stored.get("version") if isinstance(stored, dict) else None
        self.data = (
            normalize_current_store_data(stored, self._household_name)
            if version == STORAGE_VERSION
            else migrate_store_data(stored, self._household_name)
        )
        return self.data

    async def async_save(self) -> None:
        await self._store.async_save(self.data)
