"""Authenticated local HTTP views for the native Finanzplaner panel."""

from __future__ import annotations

from datetime import date, datetime, timezone
import hashlib
import io
import re
from typing import Any
from uuid import uuid4
import zipfile

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .const import DOMAIN
from .core import (
    Booking,
    CATALOG_KINDS,
    CATALOG_VALUE_FIELDS,
    RULE_FIELDS,
    booking_fingerprint,
    catalog_id_for_label,
    ensure_account,
    feed_profile_forecast,
    normalize_account_reference,
    overview_details,
    overview_values,
    parse_allocation_payload,
    parse_camt053,
    parse_mt940,
    plan_item_totals,
    record_feed_profile_purchase,
    rule_payload_from_booking,
    rule_suggestion,
    validate_pet_payload,
    validate_catalog_payload,
    validate_feed_profile_payload,
    validate_plan_item_payload,
    validate_rule_payload,
    split_amount,
)
from .coordinator import FinanzplanerCoordinator
from .storage import ensure_catalog_entries, rename_catalog_references
from .importers.excel_template import (
    XlsxImportError,
    confirm_suggestions,
    preview_payload,
    preview_template,
)


EXCEL_MAX_BYTES = 10 * 1024 * 1024
BANK_MAX_BYTES = 10 * 1024 * 1024
BANK_MAX_FILES = 500
_IBAN_PATTERN = re.compile(
    r"(?<![A-Z0-9])([A-Z]{2}\s*\d{2}(?:\s*[A-Z0-9]){11,30})(?![A-Z0-9])",
    re.IGNORECASE,
)

# Only generated opaque ID formats may bypass free-text IBAN detection, and
# only in identifier fields. Account values and arbitrary text remain redacted.
_OPAQUE_ID_PATTERN = re.compile(
    r"(?:[0-9a-f]{32}|[0-9a-f]{64}|account-[0-9a-f]{16}|"
    r"catalog-(?:category|area|project)-[0-9a-f]{16})"
)
_OPAQUE_ID_FIELDS = frozenset({
    "id", "rule_id", "account_id", "booking_id", "category_id", "area_id",
    "project_id", "pet_id", "feed_profile_id", "conflicts",
})

# ISO 13616 country lengths. Keeping this local avoids accepting a syntactically
# valid checksum for an unknown country or for a country with the wrong BBAN size.
_IBAN_LENGTHS = {
    "AD": 24,
    "AE": 23,
    "AL": 28,
    "AO": 25,
    "AT": 20,
    "AZ": 28,
    "BA": 20,
    "BE": 16,
    "BG": 22,
    "BH": 22,
    "BI": 16,
    "BR": 29,
    "BF": 27,
    "BY": 28,
    "BJ": 28,
    "BT": 24,
    "CD": 27,
    "CF": 27,
    "CG": 27,
    "CH": 21,
    "CR": 22,
    "CI": 28,
    "CM": 27,
    "CV": 25,
    "CY": 28,
    "CZ": 24,
    "DE": 22,
    "DJ": 27,
    "DK": 18,
    "DO": 28,
    "DZ": 24,
    "EE": 20,
    "EG": 29,
    "ES": 24,
    "FI": 18,
    "FO": 18,
    "FR": 27,
    "GA": 27,
    "GB": 22,
    "GE": 22,
    "GI": 23,
    "GL": 18,
    "GQ": 27,
    "GR": 27,
    "GT": 28,
    "GW": 25,
    "HN": 28,
    "HR": 21,
    "HU": 28,
    "IE": 22,
    "IL": 23,
    "IQ": 23,
    "IS": 26,
    "IT": 27,
    "IR": 26,
    "JO": 30,
    "KW": 30,
    "KZ": 20,
    "KM": 27,
    "LB": 28,
    "LC": 32,
    "LI": 21,
    "LT": 20,
    "LU": 20,
    "LV": 21,
    "LY": 25,
    "MA": 28,
    "MC": 27,
    "MD": 24,
    "ME": 22,
    "MG": 27,
    "MK": 19,
    "ML": 28,
    "MN": 20,
    "MR": 27,
    "MT": 31,
    "MU": 30,
    "MZ": 25,
    "NE": 28,
    "NI": 32,
    "NL": 18,
    "NO": 15,
    "OM": 23,
    "PK": 24,
    "PL": 28,
    "PS": 29,
    "PT": 25,
    "QA": 29,
    "RO": 24,
    "RS": 22,
    "RU": 33,
    "RW": 27,
    "SA": 24,
    "SC": 31,
    "SD": 18,
    "SE": 24,
    "SI": 19,
    "SK": 24,
    "SM": 27,
    "SO": 23,
    "ST": 25,
    "SV": 28,
    "SN": 28,
    "TD": 27,
    "TL": 23,
    "TN": 24,
    "TR": 26,
    "TG": 28,
    "UA": 29,
    "VA": 22,
    "VG": 24,
    "XK": 20,
    "YE": 30,
}


def _coordinator(hass: Any) -> FinanzplanerCoordinator | None:
    entries = hass.data.get(DOMAIN, {})
    return next(
        (value for value in entries.values() if isinstance(value, FinanzplanerCoordinator)),
        None,
    )


def _booking_payload(
    booking: Booking,
    account_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": booking_fingerprint(booking),
        "account": booking.account,
        "account_id": account_id,
        "account_reference": normalize_account_reference(booking.account),
        "booking_date": booking.booking_date.isoformat(),
        "amount": booking.amount,
        "currency": booking.currency,
        "purpose": booking.purpose,
        "reference": booking.reference,
        "counterparty": booking.counterparty,
        "allocations": [],
        "status": "unresolved",
    }


def _stored_booking_fingerprints(bookings: object) -> set[str]:
    """Return stored IDs plus canonical fingerprints for legacy records."""

    fingerprints: set[str] = set()
    if not isinstance(bookings, list):
        return fingerprints
    for item in bookings:
        if not isinstance(item, dict):
            continue
        stored_id = item.get("id")
        if isinstance(stored_id, str):
            fingerprints.add(stored_id)
        try:
            booking = Booking(
                account=str(item.get("account_reference", item.get("account", ""))),
                booking_date=date.fromisoformat(str(item["booking_date"])),
                amount=float(item["amount"]),
                purpose=str(item.get("purpose", "")),
                reference=str(item.get("reference", "")),
                counterparty=str(item.get("counterparty", "")),
                currency=str(item.get("currency", "EUR")),
            )
        except (KeyError, TypeError, ValueError):
            continue
        fingerprints.add(booking_fingerprint(booking))
    return fingerprints


def _redact_account_value(value: object) -> object:
    """Keep account context without exposing a full account identifier."""

    if not isinstance(value, str):
        return value
    normalized = normalize_account_reference(value)
    if not normalized:
        return normalized
    visible_length = min(4, len(normalized) - 1)
    suffix = normalized[-visible_length:] if visible_length else ""
    return f"…{suffix}"


def _mask_iban_occurrences(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        normalized = normalize_account_reference(match.group(1))
        return f"…{normalized[-4:]}"

    return _IBAN_PATTERN.sub(replace, value)


def _response_payload(value: object, *, field: str | None = None) -> object:
    """Copy JSON data while redacting IBANs at every response boundary."""

    if isinstance(value, dict):
        return {
            key: (
                _redact_account_value(item)
                if key in {"account", "account_reference"}
                and isinstance(item, str)
                else _response_payload(item, field=key)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_response_payload(item, field=field) for item in value]
    if isinstance(value, str):
        if field in _OPAQUE_ID_FIELDS and _OPAQUE_ID_PATTERN.fullmatch(value):
            return value
        return _mask_iban_occurrences(value)
    return value


def account_payload(account: dict[str, object]) -> dict[str, object]:
    """Return an account record without exposing its full IBAN."""

    payload = dict(account)
    iban = normalize_account_reference(payload.pop("iban", ""))
    payload.setdefault("bank", None)
    payload["iban_masked"] = f"•••• {iban[-4:]}" if iban else None
    # Use the same recursive boundary sanitizer as every other API response.
    # This also protects future nested account metadata without mutating the
    # locally stored account record.
    sanitized = _response_payload(payload)
    assert isinstance(sanitized, dict)
    return sanitized


def rule_payload(
    rule: dict[str, object],
    account: dict[str, object] | None = None,
) -> dict[str, object]:
    """Return one rule with current, redacted account display data."""

    payload = {
        field: rule[field]
        for field in (
            "id",
            "label",
            "active",
            "priority",
            "account_id",
            "counterparty",
            "purpose_contains",
            "allocations",
            "created_at",
            "updated_at",
        )
        if field in rule
    }
    payload["account"] = account_payload(account) if account is not None else None
    return _response_payload(payload)  # type: ignore[return-value]


def _normalize_iban(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Die IBAN muss als Text angegeben werden.")
    normalized = normalize_account_reference(value)
    if not re.fullmatch(r"[A-Z]{2}[0-9]{2}[A-Z0-9]+", normalized):
        raise ValueError("Bitte eine gültige IBAN eingeben.")
    country = normalized[:2]
    expected_length = _IBAN_LENGTHS.get(country)
    if expected_length is None:
        raise ValueError("Bitte eine IBAN mit bekannter Länderkennung eingeben.")
    if len(normalized) != expected_length:
        raise ValueError(
            f"Bitte eine gültige {country}-IBAN mit {expected_length} Zeichen eingeben."
        )
    rearranged = normalized[4:] + normalized[:4]
    numeric = "".join(
        str(ord(character) - ord("A") + 10) if character.isalpha() else character
        for character in rearranged
    )
    if int(numeric) % 97 != 1:
        raise ValueError("Bitte eine gültige IBAN eingeben.")
    return normalized


def validate_account_update(
    payload: object, valid_targets: set[str]
) -> dict[str, object]:
    """Validate and normalize the editable fields of an account."""

    if not isinstance(payload, dict):
        raise ValueError("Die Kontodaten müssen ein Objekt sein.")

    label = payload.get("label")
    if not isinstance(label, str) or not label.strip():
        raise ValueError("Bitte einen Kontonamen eingeben.")

    owner_targets = payload.get("owner_targets")
    if not isinstance(owner_targets, list) or not all(
        isinstance(target, str) for target in owner_targets
    ):
        raise ValueError("Die Kontoinhaber müssen eine Liste gültiger Ziele sein.")
    normalized_targets = [target.strip() for target in owner_targets]
    if (
        any(not target for target in normalized_targets)
        or len(set(normalized_targets)) != len(normalized_targets)
        or any(target not in valid_targets for target in normalized_targets)
    ):
        raise ValueError("Ein Kontoinhaber verweist nicht auf eine bekannte Person.")

    active = payload.get("active")
    if not isinstance(active, bool):
        raise ValueError("Der Aktivstatus muss ein boolescher Wert sein.")

    update: dict[str, object] = {
        "label": label.strip(),
        "owner_targets": normalized_targets,
        "active": active,
    }
    if "bank" in payload:
        bank = payload["bank"]
        if bank is not None and not isinstance(bank, str):
            raise ValueError("Der Bankname muss als Text angegeben werden.")
        update["bank"] = bank.strip() if isinstance(bank, str) and bank.strip() else None
    if "iban" in payload:
        iban = payload["iban"]
        if iban is not None and not isinstance(iban, str):
            raise ValueError("Die IBAN muss als Text angegeben werden.")
        if isinstance(iban, str) and iban.strip():
            update["iban"] = _normalize_iban(iban)
    return update


def plan_item_payload(item: dict[str, object]) -> dict[str, object]:
    """Return a copy of one plan item for the authenticated panel API."""

    return _response_payload(dict(item))  # type: ignore[return-value]


def pet_payload(pet: dict[str, object]) -> dict[str, object]:
    """Return one pet profile for the authenticated panel API."""

    return _response_payload(dict(pet))  # type: ignore[return-value]


def catalog_payload(entry: dict[str, object]) -> dict[str, object]:
    """Return one category, area or project entry for the panel API."""

    return _response_payload(dict(entry))  # type: ignore[return-value]


def feed_profile_payload(profile: dict[str, object]) -> dict[str, object]:
    """Return a profile together with its explainable forecast fields."""

    return _response_payload(
        {**dict(profile), **feed_profile_forecast(profile)}
    )  # type: ignore[return-value]


def _pet_records(
    coordinator: FinanzplanerCoordinator,
    *,
    active_only: bool = False,
) -> dict[str, dict[str, object]]:
    pets = coordinator.store.data.get("pets", [])
    if not isinstance(pets, list):
        return {}
    return {
        str(pet["id"]): pet
        for pet in pets
        if isinstance(pet, dict)
        and isinstance(pet.get("id"), str)
        and (not active_only or pet.get("active", True) is not False)
    }


def _allocation_pet_records(
    coordinator: FinanzplanerCoordinator,
    booking: dict[str, object],
) -> dict[str, dict[str, object]]:
    """Allow active pets plus snapshots already attached to this booking."""

    pets = _pet_records(coordinator, active_only=True)
    all_pets = _pet_records(coordinator)
    allocations = booking.get("allocations", [])
    if isinstance(allocations, list):
        for allocation in allocations:
            if not isinstance(allocation, dict):
                continue
            pet_id = allocation.get("pet_id")
            if isinstance(pet_id, str) and pet_id in all_pets:
                pets[pet_id] = all_pets[pet_id]
    return pets


def _feed_pet_records(
    coordinator: FinanzplanerCoordinator,
    pet_id: object = None,
) -> dict[str, dict[str, object]]:
    """Allow active pets plus the archived pet already used by a profile."""

    pets = _pet_records(coordinator, active_only=True)
    if isinstance(pet_id, str):
        archived = _pet_records(coordinator).get(pet_id)
        if archived is not None:
            pets[pet_id] = archived
    return pets


def _valid_plan_targets(hass: Any) -> set[str]:
    return {
        "household",
        *(
            state.entity_id
            for state in hass.states.async_all()
            if state.domain == "person"
        ),
    }


def _rule_accounts(
    coordinator: FinanzplanerCoordinator,
) -> dict[str, dict[str, object]]:
    accounts = coordinator.store.data.get("accounts", [])
    if not isinstance(accounts, list):
        return {}
    return {
        account["id"]: account
        for account in accounts
        if isinstance(account, dict) and isinstance(account.get("id"), str)
    }


def _rule_catalogs(
    coordinator: FinanzplanerCoordinator,
) -> dict[str, list[dict[str, object]]]:
    catalogs = coordinator.store.data.get("catalogs", {})
    if not isinstance(catalogs, dict):
        return {kind: [] for kind in CATALOG_KINDS}
    return {
        kind: [entry for entry in catalogs.get(kind, []) if isinstance(entry, dict)]
        if isinstance(catalogs.get(kind), list)
        else []
        for kind in CATALOG_KINDS
    }


def _validated_rule(
    payload: object,
    coordinator: FinanzplanerCoordinator,
    hass: Any,
    *,
    partial: bool = False,
) -> dict[str, object]:
    return validate_rule_payload(
        payload,
        valid_targets=_valid_plan_targets(hass),
        accounts=_rule_accounts(coordinator),
        catalogs=_rule_catalogs(coordinator),
        pets=_pet_records(coordinator),
        partial=partial,
    )


def _rule_draft(rule: dict[str, object]) -> dict[str, object]:
    return {field: rule.get(field) for field in RULE_FIELDS}


def _rule_list(coordinator: FinanzplanerCoordinator) -> list[dict[str, object]]:
    rules = coordinator.store.data.get("rules")
    return rules if isinstance(rules, list) else []


def _append_rule(
    coordinator: FinanzplanerCoordinator, rule: dict[str, object]
) -> None:
    rules = coordinator.store.data.get("rules")
    if not isinstance(rules, list):
        rules = []
        coordinator.store.data["rules"] = rules
    rules.append(rule)


def _catalog_link_payload(
    coordinator: FinanzplanerCoordinator,
    payload: object,
    *,
    allow_archived: bool = False,
) -> object:
    """Resolve catalog IDs and labels without breaking legacy API clients."""

    if not isinstance(payload, dict):
        return payload
    result = dict(payload)
    for kind, field in CATALOG_VALUE_FIELDS.items():
        id_field = f"{field}_id"
        if id_field not in result and field not in result:
            continue
        requested_id = result.get(id_field)
        label = result.get(field)
        entries = _catalog_entries(coordinator, kind)
        entry = next(
            (
                candidate
                for candidate in entries
                if isinstance(requested_id, str)
                and candidate.get("id") == requested_id
            ),
            None,
        ) if requested_id else None
        if requested_id and entry is None:
            raise ValueError(f"Die Zuordnung für {field} verweist auf keinen Stammdateneintrag.")
        if entry is not None:
            if entry.get("active", True) is False and not allow_archived:
                raise ValueError(f"Die Zuordnung für {field} verweist auf einen archivierten Eintrag.")
            result[id_field] = entry.get("id")
            result[field] = entry.get("label")
            continue
        if isinstance(label, str) and label.strip():
            matching_label = next(
                (
                    candidate
                    for candidate in entries
                    if str(candidate.get("label", "")).casefold()
                    == label.strip().casefold()
                ),
                None,
            )
            if (
                matching_label is not None
                and matching_label.get("active", True) is False
                and not allow_archived
            ):
                raise ValueError(
                    f"Die Zuordnung für {field} verweist auf einen archivierten Eintrag."
                )
            matching = next(
                (
                    candidate
                    for candidate in entries
                    if candidate.get("active", True) is not False
                    and str(candidate.get("label", "")).casefold() == label.strip().casefold()
                ),
                None,
            )
            result[id_field] = matching.get("id") if matching else None
            if matching is not None:
                result[field] = matching.get("label")
        else:
            result[id_field] = None
    return result


def _plan_item_draft(item: dict[str, object]) -> dict[str, object]:
    """Keep only editable fields when validating an existing item."""

    amount = item.get("amount", 0)
    try:
        numeric_amount = float(amount)
    except (TypeError, ValueError):
        numeric_amount = 0.0
    direction = item.get("direction")
    if direction not in {"income", "expense", "saving"}:
        direction = "income" if numeric_amount >= 0 else "expense"
    return {
        "name": item.get("name", ""),
        "direction": direction,
        "category": item.get("category"),
        "category_id": item.get("category_id"),
        "area": item.get("area"),
        "area_id": item.get("area_id"),
        "project": item.get("project"),
        "project_id": item.get("project_id"),
        "amount": abs(numeric_amount),
        "frequency_months": item.get("frequency_months", 1),
        "due_day": item.get("due_day"),
        "due_date": item.get("due_date"),
        "start_date": item.get("start_date"),
        "end_date": item.get("end_date"),
        "target": item.get("target"),
        "pet_id": item.get("pet_id"),
        "active": item.get("active", True),
    }


def _materialize_plan_item(
    values: dict[str, object],
    *,
    item_id: str,
    created_at: str,
    updated_at: str,
) -> dict[str, object]:
    amount = float(values["amount"])
    frequency = values.get("frequency_months")
    monthly, annual = plan_item_totals(amount, frequency if isinstance(frequency, int) else None)
    return {
        "id": item_id,
        **values,
        "amount": amount,
        "remaining_amount": amount,
        "normalized_monthly": monthly,
        "annual_amount": annual,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def _demo_overview() -> dict[str, Any]:
    return {
        "demo": True,
        "month": date.today().strftime("%Y-%m"),
        "plan": 4200.00,
        "forecast": 3710.00,
        "actual": 3285.40,
        "variance": -490.00,
        "unresolved_count": 6,
        "unresolved_total": -278.64,
        "planned_balance": 4200.00,
        "actual_balance": 3285.40,
        "areas": [
            {"name": "Haushalt", "value": -120.50},
            {"name": "PV-Anlage", "value": -45.00},
            {"name": "Hunde", "value": -18.90},
            {"name": "Sonstiges", "value": -72.20},
        ],
        "categories": [
            {"name": "Lebensmittel", "value": -612.40},
            {"name": "Wohnen", "value": -540.00},
            {"name": "Strom (inkl. PV)", "value": -221.30},
            {"name": "Hunde", "value": -183.90},
            {"name": "Mobilität", "value": -142.60},
            {"name": "Sonstiges", "value": -234.40},
        ],
        "trend": {
            "planned": [0, 380, 1000, 1600, 2200, 2800, 3400, 3900, 4500, 5200, 6000],
            "forecast": [0, 420, 1100, 1800, 2500, 3000, 3500, 3900, 4300, 4600, 4900],
            "actual": [0, 290, 690, 1020, 1430, 1710, 1980, 2300, 2400],
            "max_value": 8000,
            "today_label": "17. Sep.",
            "today_index": 8,
        },
        "last_unresolved": {
            "date": "2026-09-16",
            "purpose": "Haushaltsbedarf",
            "amount": -43.20,
        },
    }


def _overview(data: dict[str, Any], month: str | None) -> dict[str, Any]:
    if not data.get("plan_items") and not data.get("bookings") and not data.get("feed_profiles"):
        result = _demo_overview()
        if month:
            result["month"] = month
        return result

    month_value = month or date.today().strftime("%Y-%m")
    bookings = [item for item in data.get("bookings", []) if isinstance(item, dict)]
    unresolved = [item for item in bookings if item.get("status") != "resolved"]
    values = overview_values(data, month_value)
    return {
        "demo": False,
        "month": month_value,
        **values,
        **overview_details(data, month_value),
        "last_unresolved": unresolved[-1] if unresolved else None,
    }


class OverviewView(HomeAssistantView):
    """Return the current month's overview."""

    url = "/api/finanzplaner/overview"
    name = "api:finanzplaner:overview"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        data = coordinator.data if coordinator and coordinator.data else {}
        return self.json(_response_payload(_overview(data, request.query.get("month"))))


class PersonsView(HomeAssistantView):
    """Expose live Home Assistant person entities, not a copied address book."""

    url = "/api/finanzplaner/persons"
    name = "api:finanzplaner:persons"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app["hass"]
        persons = [
            {
                "entity_id": state.entity_id,
                "name": state.name,
                "unique_id": state.attributes.get("id"),
            }
            for state in hass.states.async_all()
            if state.domain == "person"
        ]
        persons.sort(key=lambda item: item["name"].casefold())
        return self.json({"persons": persons})


class AccountsView(HomeAssistantView):
    """List locally discovered accounts with masked identifiers."""

    url = "/api/finanzplaner/accounts"
    name = "api:finanzplaner:accounts"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        accounts = (
            []
            if coordinator is None
            else coordinator.store.data.get("accounts", [])
        )
        return self.json(
            _response_payload(
                {
                    "accounts": [
                        account_payload(account)
                        for account in accounts
                        if isinstance(account, dict)
                    ]
                }
            )
        )


class AccountView(HomeAssistantView):
    """Update the editable fields of one locally discovered account."""

    url = "/api/finanzplaner/accounts/{account_id}"
    name = "api:finanzplaner:account"
    requires_auth = True

    async def post(self, request: web.Request, account_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")

        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(
                text="Die Kontodaten sind kein gültiges JSON."
            ) from exc

        valid_targets = {
            "household",
            *(
                state.entity_id
                for state in request.app["hass"].states.async_all()
                if state.domain == "person"
            ),
        }
        try:
            update = validate_account_update(payload, valid_targets)
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        account = next(
            (
                item
                for item in coordinator.store.data.get("accounts", [])
                if isinstance(item, dict) and item.get("id") == account_id
            ),
            None,
        )
        if account is None:
            raise web.HTTPNotFound(text="Konto nicht gefunden.")

        normalized_iban = update.get("iban")
        if isinstance(normalized_iban, str):
            duplicate = next(
                (
                    item
                    for item in coordinator.store.data.get("accounts", [])
                    if isinstance(item, dict)
                    and item.get("id") != account_id
                    and normalize_account_reference(item.get("iban", ""))
                    == normalized_iban
                ),
                None,
            )
            if duplicate is not None:
                raise web.HTTPBadRequest(
                    text="Diese IBAN ist bereits einem anderen Konto zugeordnet."
                )

        account.update(update)
        account["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"account": account_payload(account)}))


class PetsView(HomeAssistantView):
    """List and create locally managed pet profiles."""

    url = "/api/finanzplaner/pets"
    name = "api:finanzplaner:pets"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        pets = [] if coordinator is None else coordinator.store.data.get("pets", [])
        if not isinstance(pets, list):
            pets = []
        return self.json(
            _response_payload(
                {
                    "pets": [
                        pet_payload(pet)
                        for pet in pets
                        if isinstance(pet, dict)
                    ]
                }
            )
        )

    async def post(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Tierdaten sind kein gültiges JSON.") from exc
        try:
            values = validate_pet_payload(payload)
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        now_iso = datetime.now(timezone.utc).isoformat()
        pet = {
            "id": f"pet-{uuid4().hex}",
            **values,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        pets = coordinator.store.data.get("pets")
        if not isinstance(pets, list):
            pets = []
            coordinator.store.data["pets"] = pets
        pets.append(pet)
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"pet": pet_payload(pet)}))


class PetView(HomeAssistantView):
    """Update or reversibly archive one pet profile."""

    url = "/api/finanzplaner/pets/{pet_id}"
    name = "api:finanzplaner:pet"
    requires_auth = True

    def _find_pet(
        self,
        coordinator: FinanzplanerCoordinator,
        pet_id: str,
    ) -> dict[str, object] | None:
        return _pet_records(coordinator).get(pet_id)

    async def post(self, request: web.Request, pet_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        pet = self._find_pet(coordinator, pet_id)
        if pet is None:
            raise web.HTTPNotFound(text="Tier nicht gefunden.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Tierdaten sind kein gültiges JSON.") from exc
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Die Tierdaten müssen ein Objekt sein.")
        try:
            values = validate_pet_payload(
                {
                    "name": pet.get("name", ""),
                    "pet_type": pet.get("pet_type"),
                    "active": pet.get("active", True),
                    **payload,
                }
            )
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc
        pet.update(values)
        pet["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"pet": pet_payload(pet)}))

    async def delete(self, request: web.Request, pet_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        pet = self._find_pet(coordinator, pet_id)
        if pet is None:
            raise web.HTTPNotFound(text="Tier nicht gefunden.")
        pet["active"] = False
        pet["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(
            _response_payload({"pet": pet_payload(pet), "archived": True})
        )


def _catalog_entries(
    coordinator: FinanzplanerCoordinator, kind: str
) -> list[dict[str, object]]:
    catalogs = coordinator.store.data.get("catalogs", {})
    entries = catalogs.get(kind, []) if isinstance(catalogs, dict) else []
    return [entry for entry in entries if isinstance(entry, dict)] if isinstance(entries, list) else []


def _catalog_kind(kind: str) -> str:
    if kind not in CATALOG_KINDS:
        raise ValueError("Die Stammdatenart ist ungültig.")
    return kind


def _materialize_catalog_entry(
    values: dict[str, object], *, entry_id: str, now_iso: str
) -> dict[str, object]:
    return {
        "id": entry_id,
        **values,
        "created_at": now_iso,
        "updated_at": now_iso,
    }


class CatalogsView(HomeAssistantView):
    """List the first-class categories, areas and projects."""

    url = "/api/finanzplaner/catalogs"
    name = "api:finanzplaner:catalogs"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        catalogs = (
            {kind: [] for kind in CATALOG_KINDS}
            if coordinator is None
            else {
                kind: [catalog_payload(entry) for entry in _catalog_entries(coordinator, kind)]
                for kind in CATALOG_KINDS
            }
        )
        return self.json(_response_payload({"catalogs": catalogs}))


class CatalogEntriesView(HomeAssistantView):
    """Create one category, area or project."""

    url = "/api/finanzplaner/catalogs/{kind}"
    name = "api:finanzplaner:catalogs:entries"
    requires_auth = True

    async def post(self, request: web.Request, kind: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            kind = _catalog_kind(kind)
            payload = await request.json()
            values = validate_catalog_payload(payload)
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        entries = _catalog_entries(coordinator, kind)
        label = str(values["label"])
        if any(str(entry.get("label", "")).casefold() == label.casefold() for entry in entries):
            raise web.HTTPBadRequest(text="Diese Bezeichnung ist bereits vorhanden.")
        now_iso = datetime.now(timezone.utc).isoformat()
        entry = _materialize_catalog_entry(
            values,
            entry_id=catalog_id_for_label(kind, label),
            now_iso=now_iso,
        )
        catalogs = coordinator.store.data.setdefault("catalogs", {})
        if not isinstance(catalogs, dict):
            catalogs = {catalog_kind: [] for catalog_kind in CATALOG_KINDS}
            coordinator.store.data["catalogs"] = catalogs
        kind_entries = catalogs.get(kind)
        if not isinstance(kind_entries, list):
            kind_entries = []
            catalogs[kind] = kind_entries
        kind_entries.append(entry)
        kind_entries.sort(key=lambda item: str(item.get("label", "")).casefold())
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"catalog": catalog_payload(entry), "kind": kind}))


class CatalogEntryView(HomeAssistantView):
    """Update or reversibly archive one catalog entry."""

    url = "/api/finanzplaner/catalogs/{kind}/{entry_id}"
    name = "api:finanzplaner:catalog"
    requires_auth = True

    def _find_entry(
        self,
        coordinator: FinanzplanerCoordinator,
        kind: str,
        entry_id: str,
    ) -> dict[str, object] | None:
        return next(
            (entry for entry in _catalog_entries(coordinator, kind) if entry.get("id") == entry_id),
            None,
        )

    async def post(self, request: web.Request, kind: str, entry_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            kind = _catalog_kind(kind)
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc
        entry = self._find_entry(coordinator, kind, entry_id)
        if entry is None:
            raise web.HTTPNotFound(text="Stammdateneintrag nicht gefunden.")
        try:
            payload = await request.json()
            values = validate_catalog_payload(
                {"label": entry.get("label", ""), "active": entry.get("active", True), **payload}
            )
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        label = str(values["label"])
        if any(
            other is not entry
            and str(other.get("label", "")).casefold() == label.casefold()
            for other in _catalog_entries(coordinator, kind)
        ):
            raise web.HTTPBadRequest(text="Diese Bezeichnung ist bereits vorhanden.")
        old_label = str(entry.get("label", ""))
        rename_catalog_references(
            coordinator.store.data, kind, old_label, label, str(entry.get("id", entry_id))
        )
        entry.update(values)
        entry["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"catalog": catalog_payload(entry), "kind": kind}))

    async def delete(self, request: web.Request, kind: str, entry_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            kind = _catalog_kind(kind)
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc
        entry = self._find_entry(coordinator, kind, entry_id)
        if entry is None:
            raise web.HTTPNotFound(text="Stammdateneintrag nicht gefunden.")
        entry["active"] = False
        entry["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(
            _response_payload({"catalog": catalog_payload(entry), "kind": kind, "archived": True})
        )


def _feed_profile_draft(profile: dict[str, object]) -> dict[str, object]:
    """Keep only editable feed-profile fields for update validation."""

    return {
        "pet_id": profile.get("pet_id"),
        "product": profile.get("product", ""),
        "package_unit": profile.get("package_unit", ""),
        "expected_cost": profile.get("expected_cost", 0),
        "interval_weeks": profile.get("interval_weeks"),
        "last_purchase_date": profile.get("last_purchase_date"),
        "due_soon_days": profile.get("due_soon_days", 14),
        "active": profile.get("active", True),
    }


def _materialize_feed_profile(
    values: dict[str, object],
    *,
    profile_id: str,
    created_at: str,
    updated_at: str,
) -> dict[str, object]:
    last_purchase = values.get("last_purchase_date")
    return {
        "id": profile_id,
        **values,
        "purchase_dates": [last_purchase] if last_purchase else [],
        "created_at": created_at,
        "updated_at": updated_at,
    }


class FeedProfilesView(HomeAssistantView):
    """List and create local feed-consumption profiles."""

    url = "/api/finanzplaner/feed-profiles"
    name = "api:finanzplaner:feed-profiles"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        profiles = [] if coordinator is None else coordinator.store.data.get("feed_profiles", [])
        if not isinstance(profiles, list):
            profiles = []
        return self.json(
            _response_payload(
                {
                    "feed_profiles": [
                        feed_profile_payload(profile)
                        for profile in profiles
                        if isinstance(profile, dict)
                    ]
                }
            )
        )

    async def post(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Futterprofildaten sind kein gültiges JSON.") from exc
        try:
            values = validate_feed_profile_payload(
                payload,
                _pet_records(coordinator, active_only=True),
            )
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        now_iso = datetime.now(timezone.utc).isoformat()
        profile = _materialize_feed_profile(
            values,
            profile_id=f"feed-profile-{uuid4().hex}",
            created_at=now_iso,
            updated_at=now_iso,
        )
        profiles = coordinator.store.data.get("feed_profiles")
        if not isinstance(profiles, list):
            profiles = []
            coordinator.store.data["feed_profiles"] = profiles
        profiles.append(profile)
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"feed_profile": feed_profile_payload(profile)}))


class FeedProfileView(HomeAssistantView):
    """Update or reversibly archive one feed profile."""

    url = "/api/finanzplaner/feed-profiles/{feed_profile_id}"
    name = "api:finanzplaner:feed-profile"
    requires_auth = True

    def _find_profile(
        self,
        coordinator: FinanzplanerCoordinator,
        feed_profile_id: str,
    ) -> dict[str, object] | None:
        profiles = coordinator.store.data.get("feed_profiles", [])
        return next(
            (
                profile
                for profile in profiles
                if isinstance(profile, dict) and profile.get("id") == feed_profile_id
            ),
            None,
        ) if isinstance(profiles, list) else None

    async def post(self, request: web.Request, feed_profile_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        profile = self._find_profile(coordinator, feed_profile_id)
        if profile is None:
            raise web.HTTPNotFound(text="Futterprofil nicht gefunden.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Futterprofildaten sind kein gültiges JSON.") from exc
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Die Futterprofildaten müssen ein Objekt sein.")
        try:
            values = validate_feed_profile_payload(
                {**_feed_profile_draft(profile), **payload},
                _feed_pet_records(coordinator, profile.get("pet_id")),
            )
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        profile.update(values)
        history = profile.get("purchase_dates", [])
        purchase_dates = set(history) if isinstance(history, list) else set()
        last_purchase = values.get("last_purchase_date")
        if isinstance(last_purchase, str):
            purchase_dates.add(last_purchase)
        profile["purchase_dates"] = sorted(
            value for value in purchase_dates if isinstance(value, str)
        )
        profile["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"feed_profile": feed_profile_payload(profile)}))

    async def delete(self, request: web.Request, feed_profile_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        profile = self._find_profile(coordinator, feed_profile_id)
        if profile is None:
            raise web.HTTPNotFound(text="Futterprofil nicht gefunden.")
        profile["active"] = False
        profile["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(
            _response_payload(
                {"feed_profile": feed_profile_payload(profile), "archived": True}
            )
        )


class FeedProfilePurchaseView(HomeAssistantView):
    """Record a confirmed purchase and move the next forecast forward."""

    url = "/api/finanzplaner/feed-profiles/{feed_profile_id}/purchase"
    name = "api:finanzplaner:feed-profile:purchase"
    requires_auth = True

    async def post(self, request: web.Request, feed_profile_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        profile = FeedProfileView()._find_profile(coordinator, feed_profile_id)
        if profile is None:
            raise web.HTTPNotFound(text="Futterprofil nicht gefunden.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Der Kauf ist kein gültiges JSON.") from exc
        if payload is None:
            payload = {}
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Der Kauf muss als Objekt übermittelt werden.")
        if set(payload) - {"purchase_date"}:
            raise web.HTTPBadRequest(text="Der Kauf enthält ein unbekanntes Feld.")
        try:
            normalized_date = record_feed_profile_purchase(
                profile, payload.get("purchase_date")
            )
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc
        profile["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(
            _response_payload(
                {
                    "feed_profile": feed_profile_payload(profile),
                    "purchase_date": normalized_date,
                }
            )
        )


class PlanItemsView(HomeAssistantView):
    """List plan items and create a new recurring or one-time plan item."""

    url = "/api/finanzplaner/plan-items"
    name = "api:finanzplaner:plan-items"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        plan_items = (
            []
            if coordinator is None
            else coordinator.store.data.get("plan_items", [])
        )
        return self.json(
            _response_payload(
                {
                    "plan_items": [
                        plan_item_payload(item)
                        for item in plan_items
                        if isinstance(item, dict)
                    ]
                }
            )
        )

    async def post(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(
                text="Die Planpostendaten sind kein gültiges JSON."
            ) from exc
        if isinstance(payload, dict) and "frequency_months" not in payload:
            payload = {**payload, "frequency_months": 1}
        try:
            payload = _catalog_link_payload(coordinator, payload)
            values = validate_plan_item_payload(
                payload,
                _valid_plan_targets(request.app["hass"]),
                valid_pets=_pet_records(coordinator, active_only=True),
            )
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        now_iso = datetime.now(timezone.utc).isoformat()
        item = _materialize_plan_item(
            values,
            item_id=f"plan-item-{uuid4().hex}",
            created_at=now_iso,
            updated_at=now_iso,
        )
        coordinator.store.data.setdefault("plan_items", []).append(item)
        ensure_catalog_entries(coordinator.store.data, values)
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"plan_item": plan_item_payload(item)}))


class PlanItemView(HomeAssistantView):
    """Update or reversibly archive one plan item."""

    url = "/api/finanzplaner/plan-items/{plan_item_id}"
    name = "api:finanzplaner:plan-item"
    requires_auth = True

    def _find_item(
        self,
        coordinator: FinanzplanerCoordinator,
        plan_item_id: str,
    ) -> dict[str, object] | None:
        return next(
            (
                item
                for item in coordinator.store.data.get("plan_items", [])
                if isinstance(item, dict) and item.get("id") == plan_item_id
            ),
            None,
        )

    async def post(self, request: web.Request, plan_item_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        item = self._find_item(coordinator, plan_item_id)
        if item is None:
            raise web.HTTPNotFound(text="Planposten nicht gefunden.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(
                text="Die Planpostendaten sind kein gültiges JSON."
            ) from exc
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Die Planpostendaten müssen ein Objekt sein.")
        try:
            payload = _catalog_link_payload(coordinator, payload, allow_archived=True)
            values = validate_plan_item_payload(
                {**_plan_item_draft(item), **payload},
                _valid_plan_targets(request.app["hass"]),
                valid_pets=_pet_records(coordinator),
            )
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        item.update(
            _materialize_plan_item(
                values,
                item_id=str(item["id"]),
                created_at=str(item.get("created_at", datetime.now(timezone.utc).isoformat())),
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
        )
        ensure_catalog_entries(coordinator.store.data, values)
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(_response_payload({"plan_item": plan_item_payload(item)}))

    async def delete(self, request: web.Request, plan_item_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        item = self._find_item(coordinator, plan_item_id)
        if item is None:
            raise web.HTTPNotFound(text="Planposten nicht gefunden.")
        item["active"] = False
        item["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(
            _response_payload(
                {"plan_item": plan_item_payload(item), "archived": True}
            )
        )


class RulesView(HomeAssistantView):
    """List and create local booking-allocation rules."""

    url = "/api/finanzplaner/rules"
    name = "api:finanzplaner:rules"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            return self.json({"rules": []})
        accounts = _rule_accounts(coordinator)
        return self.json(
            _response_payload(
                {
                    "rules": [
                        rule_payload(
                            rule,
                            accounts.get(rule.get("account_id"))
                            if isinstance(rule.get("account_id"), str)
                            else None,
                        )
                        for rule in _rule_list(coordinator)
                        if isinstance(rule, dict)
                    ]
                }
            )
        )

    async def post(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Regeldaten sind kein gültiges JSON.") from exc
        candidate = {**payload, "active": True} if isinstance(payload, dict) else payload
        try:
            values = _validated_rule(candidate, coordinator, request.app["hass"])
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        now_iso = datetime.now(timezone.utc).isoformat()
        rule = {
            "id": uuid4().hex,
            **values,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        _append_rule(coordinator, rule)
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        account_id = rule.get("account_id")
        account = (
            _rule_accounts(coordinator).get(account_id)
            if isinstance(account_id, str)
            else None
        )
        return self.json(_response_payload({"rule": rule_payload(rule, account)}))


class RuleView(HomeAssistantView):
    """Update editable fields or reversibly deactivate one booking rule."""

    url = "/api/finanzplaner/rules/{rule_id}"
    name = "api:finanzplaner:rule"
    requires_auth = True

    @staticmethod
    def _find_rule(
        coordinator: FinanzplanerCoordinator, rule_id: str
    ) -> dict[str, object] | None:
        return next(
            (
                rule
                for rule in _rule_list(coordinator)
                if isinstance(rule, dict) and rule.get("id") == rule_id
            ),
            None,
        )

    async def post(self, request: web.Request, rule_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        rule = self._find_rule(coordinator, rule_id)
        if rule is None:
            raise web.HTTPNotFound(text="Regel nicht gefunden.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Regeldaten sind kein gültiges JSON.") from exc
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Die Regeldaten müssen ein Objekt sein.")
        try:
            update = _validated_rule(
                payload,
                coordinator,
                request.app["hass"],
                partial=True,
            )
            values = _validated_rule(
                {**_rule_draft(rule), **update},
                coordinator,
                request.app["hass"],
            )
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        rule.update(values)
        rule["updated_at"] = datetime.now(timezone.utc).isoformat()
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        account_id = rule.get("account_id")
        account = (
            _rule_accounts(coordinator).get(account_id)
            if isinstance(account_id, str)
            else None
        )
        return self.json(_response_payload({"rule": rule_payload(rule, account)}))


class RuleFromBookingView(HomeAssistantView):
    """Build a validated booking-rule template from one resolved booking."""

    url = "/api/finanzplaner/rules/from-booking/{booking_id}"
    name = "api:finanzplaner:rule:from-booking"
    requires_auth = True

    async def post(self, request: web.Request, booking_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        bookings = coordinator.store.data.get("bookings", [])
        booking = next(
            (
                item
                for item in bookings
                if isinstance(item, dict) and item.get("id") == booking_id
            ),
            None,
        ) if isinstance(bookings, list) else None
        if booking is None or booking.get("status") != "resolved":
            raise web.HTTPBadRequest(
                text="Nur eine bestätigte Buchung kann als Regel gespeichert werden."
            )
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Regeldaten sind kein gültiges JSON.") from exc
        if payload is None:
            payload = {}
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Die Regeldaten müssen ein Objekt sein.")
        if set(payload) - {"label"}:
            raise web.HTTPBadRequest(text="Die Regeldaten enthalten ein unbekanntes Feld.")
        try:
            candidate = rule_payload_from_booking(booking)
            candidate["purpose_contains"] = None
            if "label" in payload:
                candidate["label"] = payload["label"]
            values = _validated_rule(
                candidate,
                coordinator,
                request.app["hass"],
            )
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        account_id = values.get("account_id")
        account = (
            _rule_accounts(coordinator).get(account_id)
            if isinstance(account_id, str)
            else None
        )
        return self.json(_response_payload({"rule": rule_payload(values, account)}))


class UnresolvedBookingsView(HomeAssistantView):
    """List imported bookings that still need an allocation."""

    url = "/api/finanzplaner/bookings/unresolved"
    name = "api:finanzplaner:bookings:unresolved"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        bookings = [] if not coordinator or not coordinator.data else coordinator.data.get("bookings", [])
        unresolved = [booking for booking in bookings if booking.get("status") != "resolved"]
        if coordinator is None:
            return self.json(_response_payload({"bookings": unresolved}))
        accounts = _rule_accounts(coordinator)
        catalogs = _rule_catalogs(coordinator)
        pets = _pet_records(coordinator)
        rules = _rule_list(coordinator)
        targets = _valid_plan_targets(request.app["hass"])
        projected = []
        for booking in unresolved:
            suggestion = rule_suggestion(
                booking,
                rules,
                accounts=accounts,
                valid_targets=targets,
                catalogs=catalogs,
                pets=pets,
            )
            projected.append({**booking, **suggestion})
        return self.json(_response_payload({"bookings": projected}))


class BookingAssignmentView(HomeAssistantView):
    """Resolve one booking against live Home Assistant persons or the household."""

    url = "/api/finanzplaner/bookings/{booking_id}"
    name = "api:finanzplaner:booking"
    requires_auth = True

    async def post(self, request: web.Request, booking_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Zuordnung ist kein gültiges JSON.") from exc
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Die Zuordnung muss ein Objekt sein.")

        targets = payload.get("targets")
        if not isinstance(targets, list) or not all(isinstance(target, str) for target in targets):
            raise web.HTTPBadRequest(text="Bitte mindestens ein gültiges Zuordnungsziel auswählen.")
        valid_targets = {
            "household",
            *(
                state.entity_id
                for state in request.app["hass"].states.async_all()
                if state.domain == "person"
            ),
        }
        booking = next(
            (
                item
                for item in coordinator.store.data.get("bookings", [])
                if item.get("id") == booking_id
            ),
            None,
        )
        if booking is None:
            raise web.HTTPNotFound(text="Buchung nicht gefunden.")

        area = payload.get("area") or None
        area_id = payload.get("area_id")
        category = payload.get("category")
        category_id = payload.get("category_id")
        project = payload.get("project")
        project_id = payload.get("project_id")
        pet_id = payload.get("pet_id")
        try:
            split = split_amount(float(booking.get("amount", 0)), targets)
            allocation_payload = [
                _catalog_link_payload(
                    coordinator,
                    {
                        "target": allocation.target,
                        "amount": allocation.amount,
                        "area": area,
                        "area_id": area_id,
                        "category": category,
                        "category_id": category_id,
                        "project": project,
                        "project_id": project_id,
                        "pet_id": pet_id,
                    },
                    allow_archived=True,
                )
                for allocation in split
            ]
            allocations = parse_allocation_payload(
                allocation_payload,
                float(booking.get("amount", 0)),
                valid_targets,
                _allocation_pet_records(coordinator, booking),
            )
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc
        booking["allocations"] = [
            {
                "target": allocation.target,
                "amount": allocation.amount,
                "area": allocation.area,
                "area_id": allocation.area_id,
                "category": allocation.category,
                "category_id": allocation.category_id,
                "project": allocation.project,
                "project_id": allocation.project_id,
                "pet_id": allocation.pet_id,
                "pet_name": allocation.pet_name,
                "pet_type": allocation.pet_type,
            }
            for allocation in allocations
        ]
        for allocation in booking["allocations"]:
            ensure_catalog_entries(coordinator.store.data, allocation)
        booking["status"] = "resolved"
        await coordinator.store.async_save()
        await coordinator.async_refresh()
        return self.json(_response_payload({"booking": booking}))


class BookingAllocationsView(HomeAssistantView):
    """Persist a custom cent-exact allocation for one booking."""

    url = "/api/finanzplaner/bookings/{booking_id}/allocations"
    name = "api:finanzplaner:booking:allocations"
    requires_auth = True

    async def post(self, request: web.Request, booking_id: str) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(
                text="Die Aufteilung ist kein gültiges JSON."
            ) from exc
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(
                text="Die Aufteilung muss als Objekt übermittelt werden."
            )
        allocation_payload = payload.get("allocations")
        if not isinstance(allocation_payload, list):
            raise web.HTTPBadRequest(
                text="Das Feld allocations muss eine Liste sein."
            )

        booking = next(
            (
                item
                for item in coordinator.store.data.get("bookings", [])
                if isinstance(item, dict) and item.get("id") == booking_id
            ),
            None,
        )
        if booking is None:
            raise web.HTTPNotFound(text="Buchung nicht gefunden.")

        valid_targets = {
            "household",
            *(
                state.entity_id
                for state in request.app["hass"].states.async_all()
                if state.domain == "person"
            ),
        }
        try:
            allocation_payload = [
                _catalog_link_payload(coordinator, item, allow_archived=True)
                for item in allocation_payload
            ]
            allocations = parse_allocation_payload(
                allocation_payload,
                float(booking.get("amount", 0)),
                valid_targets,
                _allocation_pet_records(coordinator, booking),
            )
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        booking["allocations"] = [
            {
                "target": allocation.target,
                "amount": allocation.amount,
                "area": allocation.area,
                "area_id": allocation.area_id,
                "category": allocation.category,
                "category_id": allocation.category_id,
                "project": allocation.project,
                "project_id": allocation.project_id,
                "pet_id": allocation.pet_id,
                "pet_name": allocation.pet_name,
                "pet_type": allocation.pet_type,
            }
            for allocation in allocations
        ]
        for allocation in booking["allocations"]:
            ensure_catalog_entries(coordinator.store.data, allocation)
        booking["status"] = "resolved"
        await coordinator.store.async_save()
        await coordinator.async_refresh()
        return self.json(_response_payload({"booking": booking}))


class ImportView(HomeAssistantView):
    """Import MT940/CAMT.053 files after an explicit user upload."""

    url = "/api/finanzplaner/import"
    name = "api:finanzplaner:import"
    requires_auth = True

    @staticmethod
    def _decode_bank_file(raw_bytes: bytes) -> str:
        try:
            return raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            return raw_bytes.decode("latin-1")

    @classmethod
    def _parse_bank_file(
        cls,
        filename: str,
        raw_bytes: bytes,
        *,
        require_bookings: bool = False,
    ) -> tuple[list[Booking], str]:
        if len(raw_bytes) > BANK_MAX_BYTES:
            raise ValueError("Die Buchungsdatei ist größer als 10 MB.")
        raw = cls._decode_bank_file(raw_bytes)
        if filename.lower().endswith((".xml", ".camt", ".camt053")) or "<Document" in raw:
            parsed = parse_camt053(raw)
            format_name = "CAMT.053"
        else:
            parsed = parse_mt940(raw)
            format_name = "MT940"
        if require_bookings and not parsed:
            raise ValueError(f"{filename} enthält keine lesbaren Buchungen.")
        return parsed, format_name

    @classmethod
    def _archive_files(
        cls,
        raw_bytes: bytes,
    ) -> list[tuple[str, bytes, list[Booking], str]]:
        if len(raw_bytes) > BANK_MAX_BYTES:
            raise ValueError("Die ZIP-Datei ist größer als 10 MB.")
        try:
            archive = zipfile.ZipFile(io.BytesIO(raw_bytes))
        except zipfile.BadZipFile as exc:
            raise ValueError("Die ZIP-Datei konnte nicht gelesen werden.") from exc

        members = []
        total_uncompressed = 0
        with archive:
            for info in archive.infolist():
                member_name = info.filename.replace("\\", "/")
                if info.is_dir() or member_name.startswith("__MACOSX/") or member_name == ".DS_Store" or member_name.endswith("/.DS_Store") or member_name.rsplit("/", 1)[-1].startswith("._"):
                    continue
                if member_name.startswith("/") or ".." in member_name.split("/"):
                    raise ValueError(f"Unsicherer Dateipfad im ZIP: {info.filename}")
                if len(members) >= BANK_MAX_FILES:
                    raise ValueError(f"Ein ZIP darf höchstens {BANK_MAX_FILES} Buchungsdateien enthalten.")
                if info.file_size > BANK_MAX_BYTES or total_uncompressed + info.file_size > BANK_MAX_BYTES:
                    raise ValueError("Die entpackten ZIP-Dateien sind zusammen größer als 10 MB.")
                if info.file_size < 1:
                    raise ValueError(f"{info.filename} ist leer.")
                member_bytes = archive.read(info)
                total_uncompressed += len(member_bytes)
                parsed, format_name = cls._parse_bank_file(member_name, member_bytes, require_bookings=True)
                members.append((member_name, member_bytes, parsed, format_name))
        if not members:
            raise ValueError("Das ZIP enthält keine Buchungsdateien.")
        return members

    async def post(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        form = await request.post()
        upload = form.get("file")
        if not isinstance(upload, web.FileField):
            raise web.HTTPBadRequest(text="Bitte eine MT940-, CAMT.053- oder ZIP-Datei auswählen.")
        raw_bytes = upload.file.read(BANK_MAX_BYTES + 1)
        filename = upload.filename or "Import"
        try:
            if filename.lower().endswith(".zip"):
                import_files = self._archive_files(raw_bytes)
            else:
                parsed, format_name = self._parse_bank_file(filename, raw_bytes)
                import_files = [(filename, raw_bytes, parsed, format_name)]
        except Exception as exc:
            raise web.HTTPBadRequest(text=f"Import konnte nicht gelesen werden: {exc}") from exc

        existing = _stored_booking_fingerprints(
            coordinator.store.data.get("bookings", [])
        )
        accepted = []
        duplicates = 0
        new_account_ids: set[str] = set()
        unconfigured_account_ids: set[str] = set()
        file_summaries = []
        for source_filename, source_bytes, parsed, format_name in import_files:
            file_accepted = 0
            file_duplicates = 0
            for booking in parsed:
                payload = _booking_payload(booking)
                if payload["id"] in existing:
                    duplicates += 1
                    file_duplicates += 1
                    continue
                account, created = ensure_account(
                    coordinator.store.data,
                    booking.account,
                    booking.account if format_name == "CAMT.053" else None,
                )
                if account is not None:
                    account_id = account.get("id")
                    payload["account_id"] = account_id
                    if isinstance(account_id, str):
                        if created:
                            new_account_ids.add(account_id)
                        if not account.get("owner_targets"):
                            unconfigured_account_ids.add(account_id)
                existing.add(payload["id"])
                coordinator.store.data["bookings"].append(payload)
                accepted.append(payload)
                file_accepted += 1
            if len(import_files) > 1:
                file_summaries.append(
                    {
                        "filename": source_filename,
                        "format": format_name,
                        "sha256": hashlib.sha256(source_bytes).hexdigest(),
                        "accepted": file_accepted,
                        "duplicates": file_duplicates,
                    }
                )
        archive_import = filename.lower().endswith(".zip")
        import_record = {
            "format": "ZIP" if archive_import else import_files[0][3],
            "filename": filename,
            "sha256": hashlib.sha256(raw_bytes).hexdigest(),
            "accepted": len(accepted),
            "duplicates": duplicates,
        }
        if archive_import:
            import_record["files"] = file_summaries
        coordinator.store.data["imports"].append(
            import_record
        )
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(
            _response_payload(
                {
                    "format": "ZIP" if archive_import else import_files[0][3],
                    "accepted": len(accepted),
                    "duplicates": duplicates,
                    "new_accounts": len(new_account_ids),
                    "unconfigured_accounts": len(unconfigured_account_ids),
                    "files": file_summaries if archive_import else [],
                    "preview": accepted,
                }
            )
        )


class ExcelPreviewView(HomeAssistantView):
    """Analyze an uploaded workbook without persisting its bytes or suggestions."""

    url = "/api/finanzplaner/excel/preview"
    name = "api:finanzplaner:excel:preview"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        form = await request.post()
        upload = form.get("file")
        if not isinstance(upload, web.FileField):
            raise web.HTTPBadRequest(text="Bitte eine XLSX-Datei auswählen.")
        filename = upload.filename or ""
        if not filename.lower().endswith(".xlsx"):
            raise web.HTTPBadRequest(text="Bitte eine XLSX-Datei auswählen.")
        raw_bytes = upload.file.read(EXCEL_MAX_BYTES + 1)
        if len(raw_bytes) > EXCEL_MAX_BYTES:
            raise web.HTTPBadRequest(text="Die XLSX-Datei darf höchstens 10 MiB groß sein.")
        try:
            preview = preview_template(raw_bytes, uuid4().hex)
        except XlsxImportError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc
        coordinator.pending_excel_previews[preview.preview_id] = preview
        return self.json(preview_payload(preview))


class ExcelConfirmView(HomeAssistantView):
    """Persist only the explicitly selected items from a transient preview."""

    url = "/api/finanzplaner/excel/confirm"
    name = "api:finanzplaner:excel:confirm"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        try:
            payload = await request.json()
        except (TypeError, ValueError) as exc:
            raise web.HTTPBadRequest(text="Die Bestätigung ist kein gültiges JSON.") from exc
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Die Bestätigung muss ein Objekt sein.")
        preview_id = payload.get("preview_id")
        if not isinstance(preview_id, str) or not preview_id:
            raise web.HTTPBadRequest(text="Eine gültige Vorschau-ID ist erforderlich.")
        preview = coordinator.pending_excel_previews.get(preview_id)
        if preview is None:
            raise web.HTTPNotFound(text="Die Excel-Vorschau wurde nicht gefunden.")
        try:
            selected_ids = payload.get("selected_ids")
            overrides = payload.get("overrides")
            items, skipped = confirm_suggestions(preview, selected_ids, overrides)
        except ValueError as exc:
            raise web.HTTPBadRequest(text=str(exc)) from exc

        import_id = uuid4().hex
        for item in items:
            item["import_id"] = import_id
        coordinator.store.data.setdefault("plan_items", []).extend(items)
        for item in items:
            ensure_catalog_entries(coordinator.store.data, item)
        coordinator.store.data.setdefault("imports", []).append(
            {
                "format": "XLSX",
                "import_id": import_id,
                "accepted": len(items),
                "skipped": skipped,
                "source_sheets": sorted({item["source_sheet"] for item in items}),
                "warning_count": len(preview.warnings),
            }
        )
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        coordinator.pending_excel_previews.pop(preview_id, None)
        return self.json(
            {
                "import_id": import_id,
                "accepted": len(items),
                "skipped": skipped,
            }
        )
