"""Authenticated local HTTP views for the native Finanzplaner panel."""

from __future__ import annotations

from datetime import date, datetime, timezone
import hashlib
import re
from typing import Any
from uuid import uuid4

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .const import DOMAIN
from .core import (
    Booking,
    booking_fingerprint,
    ensure_account,
    feed_profile_forecast,
    normalize_account_reference,
    overview_values,
    parse_allocation_payload,
    parse_camt053,
    parse_mt940,
    plan_item_totals,
    validate_pet_payload,
    validate_feed_profile_payload,
    validate_plan_item_payload,
    split_amount,
)
from .coordinator import FinanzplanerCoordinator
from .importers.excel_template import (
    XlsxImportError,
    confirm_suggestions,
    preview_payload,
    preview_template,
)


EXCEL_MAX_BYTES = 10 * 1024 * 1024
_IBAN_PATTERN = re.compile(
    r"(?<![A-Z0-9])([A-Z]{2}\s*\d{2}(?:\s*[A-Z0-9]){11,30})(?![A-Z0-9])",
    re.IGNORECASE,
)

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


def _response_payload(value: object) -> object:
    """Copy JSON data while redacting IBANs at every response boundary."""

    if isinstance(value, dict):
        return {
            key: (
                _redact_account_value(item)
                if key in {"account", "account_reference"}
                and isinstance(item, str)
                else _response_payload(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_response_payload(item) for item in value]
    if isinstance(value, str):
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
        "area": item.get("area"),
        "project": item.get("project"),
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
        "areas": [],
        "categories": [],
        "trend": {"planned": [], "forecast": [], "actual": [], "today_index": 0},
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
        if profile.get("active", True) is False:
            raise web.HTTPBadRequest(
                text="Ein archiviertes Futterprofil muss vor dem Kauf reaktiviert werden."
            )
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
        purchase_date = payload.get("purchase_date", date.today().isoformat())
        if not isinstance(purchase_date, str) or not purchase_date.strip():
            raise web.HTTPBadRequest(text="Bitte ein Kaufdatum im Format JJJJ-MM-TT angeben.")
        normalized_date = purchase_date.strip()
        try:
            parsed_purchase_date = date.fromisoformat(normalized_date)
        except ValueError as exc:
            raise web.HTTPBadRequest(
                text="Das Kaufdatum muss im Format JJJJ-MM-TT angegeben werden."
            ) from exc
        if parsed_purchase_date.isoformat() != normalized_date:
            raise web.HTTPBadRequest(
                text="Das Kaufdatum muss im Format JJJJ-MM-TT angegeben werden."
            )
        if parsed_purchase_date > date.today():
            raise web.HTTPBadRequest(text="Das Kaufdatum darf nicht in der Zukunft liegen.")

        history = profile.get("purchase_dates", [])
        purchase_dates = set(history) if isinstance(history, list) else set()
        purchase_dates.add(normalized_date)
        profile["purchase_dates"] = sorted(
            value for value in purchase_dates if isinstance(value, str)
        )
        profile["last_purchase_date"] = profile["purchase_dates"][-1]
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


class UnresolvedBookingsView(HomeAssistantView):
    """List imported bookings that still need an allocation."""

    url = "/api/finanzplaner/bookings/unresolved"
    name = "api:finanzplaner:bookings:unresolved"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        bookings = [] if not coordinator or not coordinator.data else coordinator.data.get("bookings", [])
        unresolved = [booking for booking in bookings if booking.get("status") != "resolved"]
        return self.json(_response_payload({"bookings": unresolved}))


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
        category = payload.get("category")
        project = payload.get("project")
        pet_id = payload.get("pet_id")
        try:
            split = split_amount(float(booking.get("amount", 0)), targets)
            allocations = parse_allocation_payload(
                [
                    {
                        "target": allocation.target,
                        "amount": allocation.amount,
                        "area": area,
                        "category": category,
                        "project": project,
                        "pet_id": pet_id,
                    }
                    for allocation in split
                ],
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
                "category": allocation.category,
                "project": allocation.project,
                "pet_id": allocation.pet_id,
                "pet_name": allocation.pet_name,
                "pet_type": allocation.pet_type,
            }
            for allocation in allocations
        ]
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
                "category": allocation.category,
                "project": allocation.project,
                "pet_id": allocation.pet_id,
                "pet_name": allocation.pet_name,
                "pet_type": allocation.pet_type,
            }
            for allocation in allocations
        ]
        booking["status"] = "resolved"
        await coordinator.store.async_save()
        await coordinator.async_refresh()
        return self.json(_response_payload({"booking": booking}))


class ImportView(HomeAssistantView):
    """Import one MT940 or CAMT.053 file after an explicit user upload."""

    url = "/api/finanzplaner/import"
    name = "api:finanzplaner:import"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        coordinator = _coordinator(request.app["hass"])
        if coordinator is None:
            raise web.HTTPBadRequest(text="Finanzplaner ist nicht eingerichtet.")
        form = await request.post()
        upload = form.get("file")
        if not isinstance(upload, web.FileField):
            raise web.HTTPBadRequest(text="Bitte eine MT940- oder CAMT.053-Datei auswählen.")
        raw_bytes = upload.file.read()
        try:
            raw = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            raw = raw_bytes.decode("latin-1")
        filename = upload.filename or "Import"
        try:
            if filename.lower().endswith((".xml", ".camt", ".camt053")) or "<Document" in raw:
                parsed = parse_camt053(raw)
                format_name = "CAMT.053"
            else:
                parsed = parse_mt940(raw)
                format_name = "MT940"
        except Exception as exc:
            raise web.HTTPBadRequest(text=f"Import konnte nicht gelesen werden: {exc}") from exc

        existing = _stored_booking_fingerprints(
            coordinator.store.data.get("bookings", [])
        )
        accepted = []
        duplicates = 0
        new_account_ids: set[str] = set()
        unconfigured_account_ids: set[str] = set()
        for booking in parsed:
            payload = _booking_payload(booking)
            if payload["id"] in existing:
                duplicates += 1
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
        coordinator.store.data["imports"].append(
            {
                "format": format_name,
                "filename": filename,
                "sha256": hashlib.sha256(raw_bytes).hexdigest(),
                "accepted": len(accepted),
                "duplicates": duplicates,
            }
        )
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
        return self.json(
            _response_payload(
                {
                    "format": format_name,
                    "accepted": len(accepted),
                    "duplicates": duplicates,
                    "new_accounts": len(new_account_ids),
                    "unconfigured_accounts": len(unconfigured_account_ids),
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
