"""Versioned persistent data for Finanzplaner."""

from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timezone
import hashlib
from typing import Any

from .const import DEFAULT_HOUSEHOLD_NAME, STORAGE_KEY, STORAGE_VERSION
from .core import (
    CATALOG_KINDS,
    CATALOG_VALUE_FIELDS,
    account_id_for_reference,
    catalog_id_for_label,
    normalize_account_reference,
    sender_from_camt_source,
)


def empty_data(household_name: str = DEFAULT_HOUSEHOLD_NAME) -> dict[str, Any]:
    return {
        "version": STORAGE_VERSION,
        "settings": {"household_name": household_name, "currency": "EUR"},
        "accounts": [],
        "pets": [],
        "feed_profiles": [],
        "catalogs": {kind: [] for kind in CATALOG_KINDS},
        "plan_items": [],
        "bookings": [],
        "original_uploads": [],
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


def _normalize_original_uploads(data: dict[str, Any]) -> None:
    """Keep the optional byte-preserving upload archive structurally valid."""

    if not isinstance(data.get("original_uploads"), list):
        data["original_uploads"] = []


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
        item.setdefault("category_id", None)
        item.setdefault("area", None)
        item.setdefault("area_id", None)
        item.setdefault("project", None)
        item.setdefault("project_id", None)
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
            allocation.setdefault("category_id", None)
            allocation.setdefault("area_id", None)
            allocation.setdefault("project_id", None)
            pet_id = allocation.get("pet_id")
            pet = pets.get(pet_id) if pets and isinstance(pet_id, str) else None
            if pet is not None:
                if not allocation.get("pet_name"):
                    allocation["pet_name"] = pet.get("name")
                if not allocation.get("pet_type"):
                    allocation["pet_type"] = pet.get("pet_type")


def _normalize_rules(data: dict[str, Any]) -> None:
    """Keep existing rule records and replace malformed containers safely."""

    if not isinstance(data.get("rules"), list):
        data["rules"] = []
        return
    for rule in data["rules"]:
        if not isinstance(rule, dict):
            continue
        rule.setdefault("counterparty_account", None)
        if isinstance(rule["counterparty_account"], str):
            rule["counterparty_account"] = normalize_account_reference(rule["counterparty_account"])
        else:
            rule["counterparty_account"] = None
        rule.setdefault("direction", None)
        rule.setdefault("amount_min", None)
        rule.setdefault("amount_max", None)


def _catalog_source_values(data: dict[str, Any], kind: str) -> list[str]:
    field = CATALOG_VALUE_FIELDS[kind]
    values: list[str] = []
    plan_items = data.get("plan_items", [])
    if isinstance(plan_items, list):
        values.extend(
            item.get(field)
            for item in plan_items
            if isinstance(item, dict) and isinstance(item.get(field), str)
        )
    bookings = data.get("bookings", [])
    if isinstance(bookings, list):
        for booking in bookings:
            if not isinstance(booking, dict):
                continue
            allocations = booking.get("allocations", [])
            if not isinstance(allocations, list):
                continue
            values.extend(
                allocation.get(field)
                for allocation in allocations
                if isinstance(allocation, dict) and isinstance(allocation.get(field), str)
            )
    return values


def _normalize_catalogs(data: dict[str, Any]) -> None:
    """Normalize first-class catalogs and backfill values from legacy text."""

    raw_catalogs = data.get("catalogs")
    raw_catalogs = raw_catalogs if isinstance(raw_catalogs, dict) else {}
    catalogs: dict[str, list[dict[str, Any]]] = {}
    now_iso = None
    for kind in CATALOG_KINDS:
        entries = raw_catalogs.get(kind, [])
        entries = entries if isinstance(entries, list) else []
        normalized: dict[tuple[str, str], dict[str, Any]] = {}
        used_ids: set[str] = set()
        for entry in entries:
            if isinstance(entry, str):
                label = entry.strip()
                candidate = {"label": label}
            elif isinstance(entry, dict):
                label = entry.get("label", entry.get("name", ""))
                label = label.strip() if isinstance(label, str) else ""
                candidate = entry
            else:
                continue
            if not label:
                continue
            parent_id = None
            if kind == "categories":
                raw_parent_id = candidate.get("parent_id")
                parent_id = (
                    raw_parent_id.strip()
                    if isinstance(raw_parent_id, str) and raw_parent_id.strip()
                    else None
                )
            key = (parent_id or "", label.casefold())
            if key in normalized:
                continue
            item = {
                "id": candidate.get("id") if isinstance(candidate.get("id"), str) else None,
                "label": label,
                "active": candidate.get("active", True) is not False,
                "created_at": candidate.get("created_at"),
                "updated_at": candidate.get("updated_at"),
            }
            if kind == "categories":
                item["parent_id"] = parent_id
            item["id"] = item["id"] or catalog_id_for_label(kind, label, parent_id)
            if item["id"] in used_ids:
                item["id"] = catalog_id_for_label(
                    kind, f"{label}:{len(used_ids)}", parent_id
                )
            used_ids.add(item["id"])
            normalized[key] = item

        for value in _catalog_source_values(data, kind):
            label = value.strip()
            key = ("", label.casefold())
            if not label or key in normalized:
                continue
            normalized[key] = {
                "id": catalog_id_for_label(kind, label),
                "label": label,
                "active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        if kind == "categories":
            category_by_id = {item["id"]: item for item in normalized.values()}
            for item in category_by_id.values():
                parent = category_by_id.get(item.get("parent_id"))
                if parent is None or parent is item or parent.get("parent_id"):
                    item["parent_id"] = None
        catalogs[kind] = sorted(
            normalized.values(), key=lambda item: (item["label"].casefold(), item["id"])
        )
    data["catalogs"] = catalogs


def _link_catalog_references(data: dict[str, Any]) -> None:
    """Attach stable catalog IDs while retaining old labels as snapshots."""

    catalogs = data.get("catalogs", {})
    if not isinstance(catalogs, dict):
        return
    lookup: dict[str, dict[str, dict[str, Any]]] = {}
    for kind in CATALOG_KINDS:
        entries = catalogs.get(kind, [])
        if not isinstance(entries, list):
            continue
        lookup[kind] = {
            str(entry.get("id")): entry
            for entry in entries
            if isinstance(entry, dict) and isinstance(entry.get("id"), str)
        }
        lookup[kind].update(
            {
                f"label:{str(entry.get('label')).casefold()}": entry
                for entry in entries
                if isinstance(entry, dict) and isinstance(entry.get("label"), str)
            }
        )

    def link_record(record: dict[str, Any]) -> None:
        for kind, field in CATALOG_VALUE_FIELDS.items():
            id_field = f"{field}_id"
            value_id = record.get(id_field)
            label = record.get(field)
            entry = lookup.get(kind, {}).get(str(value_id)) if value_id else None
            if entry is None and isinstance(label, str) and label.strip():
                entry = lookup.get(kind, {}).get(f"label:{label.strip().casefold()}")
            if entry is None:
                record[id_field] = None
                continue
            record[id_field] = entry["id"]
            if not isinstance(label, str) or not label.strip():
                record[field] = entry["label"]

    plan_items = data.get("plan_items", [])
    if isinstance(plan_items, list):
        for item in plan_items:
            if isinstance(item, dict):
                link_record(item)
    bookings = data.get("bookings", [])
    if isinstance(bookings, list):
        for booking in bookings:
            if not isinstance(booking, dict):
                continue
            allocations = booking.get("allocations", [])
            if isinstance(allocations, list):
                for allocation in allocations:
                    if isinstance(allocation, dict):
                        link_record(allocation)


def ensure_catalog_entries(data: dict[str, Any], values: dict[str, object]) -> None:
    """Add newly entered labels to their local catalogs without changing links."""

    catalogs = data.get("catalogs")
    if not isinstance(catalogs, dict):
        catalogs = {kind: [] for kind in CATALOG_KINDS}
        data["catalogs"] = catalogs
    now_iso = datetime.now(timezone.utc).isoformat()
    for kind in CATALOG_KINDS:
        field = CATALOG_VALUE_FIELDS[kind]
        reference_id = values.get(f"{field}_id")
        entries = catalogs.get(kind)
        if isinstance(reference_id, str) and isinstance(entries, list) and any(
            isinstance(entry, dict) and entry.get("id") == reference_id
            for entry in entries
        ):
            continue
        label = values.get(field)
        if not isinstance(label, str) or not label.strip():
            continue
        label = label.strip()
        if not isinstance(entries, list):
            entries = []
            catalogs[kind] = entries
        parent_id = None
        if kind == "categories":
            raw_parent_id = values.get("parent_id")
            parent_id = (
                raw_parent_id.strip()
                if isinstance(raw_parent_id, str) and raw_parent_id.strip()
                else None
            )
        scope_key = (parent_id or "", label.casefold())
        if any(
            isinstance(entry, dict)
            and isinstance(entry.get("label"), str)
            and (
                (
                    str(entry.get("parent_id") or "")
                    if kind == "categories"
                    else ""
                ),
                entry["label"].casefold(),
            )
            == scope_key
            for entry in entries
        ):
            continue
        entry = {
            "id": catalog_id_for_label(kind, label, parent_id),
            "label": label,
            "active": True,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        if kind == "categories":
            entry["parent_id"] = parent_id
        entries.append(entry)
        entries.sort(key=lambda item: (str(item.get("label", "")).casefold(), str(item.get("id", ""))))
    _link_catalog_references(data)


def rename_catalog_references(
    data: dict[str, Any],
    kind: str,
    old_label: str,
    new_label: str,
    entry_id: str | None = None,
) -> None:
    """Keep historical plan and allocation labels aligned after a rename."""

    field = CATALOG_VALUE_FIELDS[kind]
    id_field = f"{field}_id"
    if old_label == new_label:
        return
    plan_items = data.get("plan_items", [])
    if isinstance(plan_items, list):
        for item in plan_items:
            if (
                isinstance(item, dict)
                and item.get(field) == old_label
                and not (entry_id and item.get(id_field) == entry_id)
            ):
                item[field] = new_label
                if entry_id:
                    item[id_field] = entry_id
    bookings = data.get("bookings", [])
    if isinstance(bookings, list):
        for booking in bookings:
            if not isinstance(booking, dict):
                continue
            allocations = booking.get("allocations", [])
            if not isinstance(allocations, list):
                continue
            for allocation in allocations:
                if (
                    isinstance(allocation, dict)
                    and allocation.get(field) == old_label
                    and not (entry_id and allocation.get(id_field) == entry_id)
                ):
                    allocation[field] = new_label
                    if entry_id:
                        allocation[id_field] = entry_id


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
        if not isinstance(booking.get("matched_rule"), dict):
            booking["matched_rule"] = None
        if not isinstance(booking.get("sender"), str) or not booking["sender"].strip():
            booking["sender"] = sender_from_camt_source(booking.get("source_data"))
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
    _normalize_original_uploads(data)
    _normalize_pets(data)
    pets = _pet_by_id(data)
    _normalize_feed_profiles(data, pets)
    _normalize_plan_items(data, pets)
    _normalize_booking_allocations(data, pets)
    _normalize_rules(data)
    _normalize_catalogs(data)
    _link_catalog_references(data)
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
        if not isinstance(booking.get("matched_rule"), dict):
            booking["matched_rule"] = None
        if not isinstance(booking.get("sender"), str) or not booking["sender"].strip():
            booking["sender"] = sender_from_camt_source(booking.get("source_data"))

    data["version"] = STORAGE_VERSION
    _normalize_original_uploads(data)
    _normalize_pets(data)
    pets = _pet_by_id(data)
    _normalize_feed_profiles(data, pets)
    _normalize_plan_items(data, pets)
    _normalize_booking_allocations(data, pets)
    _normalize_rules(data)
    _normalize_catalogs(data)
    _link_catalog_references(data)
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
