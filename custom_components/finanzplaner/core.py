"""Small dependency-free domain core used by the integration and its tests."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import re
from typing import TypedDict
import xml.etree.ElementTree as ET

from .booking_source import source_xml_node


MONEY_QUANT = Decimal("0.01")
PLAN_DIRECTIONS = frozenset({"income", "expense", "saving"})
PLAN_FREQUENCIES = frozenset({None, 1, 2, 3, 6, 12})
PLAN_ITEM_FIELDS = frozenset(
    {
        "name",
        "direction",
        "category",
        "category_id",
        "area",
        "area_id",
        "project",
        "project_id",
        "amount",
        "frequency_months",
        "due_day",
        "due_date",
        "start_date",
        "end_date",
        "target",
        "pet_id",
        "active",
    }
)

CATALOG_KINDS = ("categories", "areas", "projects")
CATALOG_FIELDS = frozenset({"label", "active"})
CATALOG_VALUE_FIELDS = {
    "categories": "category",
    "areas": "area",
    "projects": "project",
}
RULE_FIELDS = frozenset(
    {
        "label",
        "active",
        "priority",
        "account_id",
        "counterparty",
        "purpose_contains",
        "allocations",
    }
)
RULE_ALLOCATION_FIELDS = frozenset(
    {"target", "share_percent", "area_id", "category_id", "project_id", "pet_id"}
)


def catalog_id_for_label(kind: str, label: str) -> str:
    """Return a deterministic local ID for a catalog label."""

    material = f"{kind}:{label.casefold()}"
    prefix = CATALOG_VALUE_FIELDS.get(kind, kind.rstrip("s"))
    return f"catalog-{prefix}-{hashlib.sha256(material.encode('utf-8')).hexdigest()[:16]}"

PET_FIELDS = frozenset({"name", "pet_type", "active"})
FEED_PROFILE_FIELDS = frozenset(
    {
        "pet_id",
        "product",
        "package_unit",
        "expected_cost",
        "interval_weeks",
        "last_purchase_date",
        "due_soon_days",
        "active",
    }
)


def normalize_account_reference(value: str) -> str:
    """Normalize an imported account reference for matching."""

    return "".join(str(value or "").split()).upper()


def account_id_for_reference(value: str) -> str | None:
    """Return the stable local account ID for a normalized reference."""

    normalized = normalize_account_reference(value)
    if not normalized:
        return None
    return f"account-{hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]}"


def validate_pet_payload(payload: object, *, partial: bool = False) -> dict[str, object]:
    """Validate one locally managed pet profile."""

    if not isinstance(payload, dict):
        raise ValueError("Die Tierdaten müssen ein Objekt sein.")
    unknown = set(payload) - PET_FIELDS
    if unknown:
        raise ValueError("Die Tierdaten enthalten ein unbekanntes Feld.")

    normalized: dict[str, object] = {}
    if not partial or "name" in payload:
        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Bitte einen Tiernamen eingeben.")
        normalized["name"] = name.strip()
        if len(normalized["name"]) > 80:
            raise ValueError("Der Tiername darf höchstens 80 Zeichen enthalten.")

    if not partial or "pet_type" in payload:
        normalized["pet_type"] = _optional_plan_text(
            payload.get("pet_type"), "Der Tier-Typ", max_length=60
        )

    if not partial or "active" in payload:
        active = payload.get("active", True)
        if not isinstance(active, bool):
            raise ValueError("Der Aktivstatus muss ein boolescher Wert sein.")
        normalized["active"] = active
    return normalized


def validate_catalog_payload(
    payload: object, *, partial: bool = False
) -> dict[str, object]:
    """Validate one editable category, area or project entry."""

    if not isinstance(payload, dict):
        raise ValueError("Die Stammdaten müssen ein Objekt sein.")
    unknown = set(payload) - CATALOG_FIELDS
    if unknown:
        raise ValueError("Die Stammdaten enthalten ein unbekanntes Feld.")

    normalized: dict[str, object] = {}
    if not partial or "label" in payload:
        label = payload.get("label")
        if not isinstance(label, str) or not label.strip():
            raise ValueError("Bitte eine Bezeichnung eingeben.")
        normalized["label"] = label.strip()
        if len(normalized["label"]) > 120:
            raise ValueError("Die Bezeichnung darf höchstens 120 Zeichen enthalten.")

    if not partial or "active" in payload:
        active = payload.get("active", True)
        if not isinstance(active, bool):
            raise ValueError("Der Aktivstatus muss ein boolescher Wert sein.")
        normalized["active"] = active
    return normalized


def _positive_interval(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal, str)):
        raise ValueError(f"{label} muss positiv angegeben werden.")
    try:
        raw = str(value).strip().replace(" ", "").replace(",", ".")
        interval = Decimal(raw)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{label} muss positiv angegeben werden.") from exc
    if (
        not interval.is_finite()
        or interval <= 0
        or interval > 520
        or interval.as_tuple().exponent < -2
    ):
        raise ValueError(f"{label} muss zwischen 0,01 und 520 Wochen liegen.")
    return float(interval.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def validate_feed_profile_payload(
    payload: object,
    valid_pets: dict[str, dict[str, object]] | set[str],
    *,
    partial: bool = False,
) -> dict[str, object]:
    """Validate one local feed-consumption profile and attach a pet snapshot."""

    if not isinstance(payload, dict):
        raise ValueError("Die Futterprofildaten müssen ein Objekt sein.")
    unknown = set(payload) - FEED_PROFILE_FIELDS
    if unknown:
        raise ValueError("Das Futterprofil enthält ein unbekanntes Feld.")

    normalized: dict[str, object] = {}
    if not partial or "pet_id" in payload:
        pet_id = payload.get("pet_id")
        if not isinstance(pet_id, str) or not pet_id.strip():
            raise ValueError("Bitte ein Tier für das Futterprofil auswählen.")
        pet_id = pet_id.strip()
        if pet_id not in valid_pets:
            raise ValueError("Die Tierzuordnung verweist nicht auf ein bekanntes Tier.")
        normalized["pet_id"] = pet_id
        pet = valid_pets.get(pet_id) if isinstance(valid_pets, dict) else None
        normalized["pet_name"] = (
            _optional_plan_text(pet.get("name"), "Der Tiername", max_length=80)
            if pet is not None
            else None
        )
        normalized["pet_type"] = (
            _optional_plan_text(pet.get("pet_type"), "Der Tier-Typ", max_length=60)
            if pet is not None
            else None
        )

    for field, label, max_length in (
        ("product", "Das Futter", 120),
        ("package_unit", "Die Verpackungseinheit", 80),
    ):
        if not partial or field in payload:
            value = _optional_plan_text(payload.get(field), label, max_length=max_length)
            if value is None:
                raise ValueError(f"Bitte {label[0].lower() + label[1:]} angeben.")
            normalized[field] = value

    if not partial or "expected_cost" in payload:
        normalized["expected_cost"] = _plan_amount(payload.get("expected_cost"))

    if not partial or "interval_weeks" in payload:
        value = payload.get("interval_weeks")
        normalized["interval_weeks"] = (
            None if value in (None, "") else _positive_interval(value, "Das Verbrauchsintervall")
        )

    if not partial or "last_purchase_date" in payload:
        normalized["last_purchase_date"] = _plan_date(
            payload.get("last_purchase_date"), "Das Datum des letzten Kaufs"
        )

    if not partial or "due_soon_days" in payload:
        due_soon_days = payload.get("due_soon_days", 14)
        if (
            isinstance(due_soon_days, bool)
            or not isinstance(due_soon_days, int)
            or not 0 <= due_soon_days <= 90
        ):
            raise ValueError("Das Vorwarnfenster muss zwischen 0 und 90 Tagen liegen.")
        normalized["due_soon_days"] = due_soon_days

    if not partial or "active" in payload:
        active = payload.get("active", True)
        if not isinstance(active, bool):
            raise ValueError("Der Aktivstatus muss ein boolescher Wert sein.")
        normalized["active"] = active
    return normalized


def _optional_plan_text(
    value: object,
    label: str,
    *,
    max_length: int = 120,
) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{label} muss als Text angegeben werden.")
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise ValueError(f"{label} darf höchstens {max_length} Zeichen enthalten.")
    return normalized


def _plan_date(value: object, label: str) -> str | None:
    normalized = _optional_plan_text(value, label, max_length=10)
    if normalized is None:
        return None
    try:
        parsed = date.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"{label} muss ein gültiges Datum sein.") from exc
    if parsed.isoformat() != normalized:
        raise ValueError(f"{label} muss im Format JJJJ-MM-TT angegeben werden.")
    return normalized


def _plan_amount(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal, str)):
        raise ValueError("Der Planbetrag muss ein positiver Eurobetrag sein.")
    try:
        raw = str(value).strip().replace(" ", "")
        if "," in raw:
            raw = raw.replace(".", "").replace(",", ".")
        amount = Decimal(raw)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("Der Planbetrag muss ein positiver Eurobetrag sein.") from exc
    if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
        raise ValueError(
            "Der Planbetrag muss positiv sein und darf höchstens zwei Nachkommastellen haben."
        )
    return float(amount.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP))


def validate_plan_item_payload(
    payload: object,
    valid_targets: set[str],
    *,
    partial: bool = False,
    valid_pets: dict[str, dict[str, object]] | set[str] | None = None,
) -> dict[str, object]:
    """Validate editable plan-item fields and return normalized values."""

    if not isinstance(payload, dict):
        raise ValueError("Die Planpostendaten müssen ein Objekt sein.")
    unknown = set(payload) - PLAN_ITEM_FIELDS
    if unknown:
        raise ValueError("Die Planposten enthalten ein unbekanntes Feld.")

    normalized: dict[str, object] = {}
    if not partial or "name" in payload:
        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Bitte eine Bezeichnung für den Planposten eingeben.")
        normalized["name"] = name.strip()
        if len(normalized["name"]) > 120:
            raise ValueError("Die Bezeichnung darf höchstens 120 Zeichen enthalten.")

    if not partial or "direction" in payload:
        direction = payload.get("direction")
        if direction not in PLAN_DIRECTIONS:
            raise ValueError("Die Richtung des Planpostens ist ungültig.")
        normalized["direction"] = direction

    if not partial or "amount" in payload:
        normalized["amount"] = _plan_amount(payload.get("amount"))

    if not partial or "frequency_months" in payload:
        frequency = payload.get("frequency_months")
        if frequency is not None and (
            isinstance(frequency, bool)
            or not isinstance(frequency, int)
            or frequency not in PLAN_FREQUENCIES
        ):
            raise ValueError("Der Rhythmus des Planpostens ist ungültig.")
        normalized["frequency_months"] = frequency

    for field, label in (
        ("category", "Die Kategorie"),
        ("area", "Der Bereich"),
        ("project", "Das Projekt"),
    ):
        if not partial or field in payload:
            normalized[field] = _optional_plan_text(payload.get(field), label)
        id_field = f"{field}_id"
        if not partial or id_field in payload:
            normalized[id_field] = _optional_plan_text(
                payload.get(id_field), f"Die ID für {label[4:].lower()}", max_length=120
            )

    if not partial or "target" in payload:
        target = payload.get("target")
        if target is not None:
            target = _optional_plan_text(target, "Das Planungsziel", max_length=80)
            if target is not None and target not in valid_targets:
                raise ValueError("Das Planungsziel verweist nicht auf eine bekannte Person.")
        normalized["target"] = target

    if not partial or "pet_id" in payload:
        pet_id = payload.get("pet_id")
        if pet_id in (None, ""):
            normalized["pet_id"] = None
            normalized["pet_name"] = None
            normalized["pet_type"] = None
        elif not isinstance(pet_id, str) or not pet_id.strip():
            raise ValueError("Die Tierzuordnung ist ungültig.")
        elif valid_pets is None or pet_id.strip() not in valid_pets:
            raise ValueError("Die Tierzuordnung verweist nicht auf ein bekanntes Tier.")
        else:
            pet_id = pet_id.strip()
            normalized["pet_id"] = pet_id
            pet = valid_pets.get(pet_id) if isinstance(valid_pets, dict) else None
            normalized["pet_name"] = (
                _optional_plan_text(pet.get("name"), "Der Tiername", max_length=80)
                if pet is not None
                else None
            )
            normalized["pet_type"] = (
                _optional_plan_text(pet.get("pet_type"), "Der Tier-Typ", max_length=60)
                if pet is not None
                else None
            )

    if not partial or "active" in payload:
        active = payload.get("active", True)
        if not isinstance(active, bool):
            raise ValueError("Der Aktivstatus muss ein boolescher Wert sein.")
        normalized["active"] = active

    for field, label in (
        ("due_date", "Das Fälligkeitsdatum"),
        ("start_date", "Der Beginn"),
        ("end_date", "Das Ende"),
    ):
        if not partial or field in payload:
            normalized[field] = _plan_date(payload.get(field), label)

    if not partial or "due_day" in payload:
        due_day = payload.get("due_day")
        if due_day in (None, ""):
            normalized["due_day"] = None
        elif isinstance(due_day, bool) or not isinstance(due_day, int) or not 1 <= due_day <= 31:
            raise ValueError("Der Fälligkeitstag muss zwischen 1 und 31 liegen.")
        else:
            normalized["due_day"] = due_day

    start = normalized.get("start_date")
    end = normalized.get("end_date")
    if start and end and start > end:
        raise ValueError("Das Ende darf nicht vor dem Beginn liegen.")

    if not partial or "due_date" in payload:
        due_date = normalized.get("due_date")
        if due_date and start and due_date < start:
            raise ValueError("Das Fälligkeitsdatum darf nicht vor dem Beginn liegen.")
        if due_date and end and due_date > end:
            raise ValueError("Das Fälligkeitsdatum darf nicht nach dem Ende liegen.")

    return normalized


def plan_item_totals(amount: float, frequency_months: int | None) -> tuple[float | None, float]:
    """Return monthly and annual equivalents for a plan-item payment."""

    payment = _money(amount)
    if frequency_months is None:
        return None, float(payment)
    monthly = (payment / Decimal(frequency_months)).quantize(
        MONEY_QUANT, rounding=ROUND_HALF_UP
    )
    annual = (payment * Decimal("12") / Decimal(frequency_months)).quantize(
        MONEY_QUANT, rounding=ROUND_HALF_UP
    )
    return float(monthly), float(annual)


def ensure_account(
    data: dict[str, object],
    account_reference: str,
    iban: str | None = None,
) -> tuple[dict[str, object] | None, bool]:
    """Return the matching imported account, creating it when necessary."""

    normalized_reference = normalize_account_reference(account_reference)
    normalized_iban = normalize_account_reference(iban) if iban else ""
    if not normalized_reference:
        return None, False

    accounts = data.get("accounts")
    if not isinstance(accounts, list):
        accounts = []
        data["accounts"] = accounts

    matching_account: dict[str, object] | None = None
    if normalized_iban:
        matching_account = next(
            (
                account
                for account in accounts
                if isinstance(account, dict)
                and normalize_account_reference(account.get("iban", ""))
                == normalized_iban
            ),
            None,
        )
    if matching_account is None:
        matching_account = next(
            (
                account
                for account in accounts
                if isinstance(account, dict)
                and normalize_account_reference(account.get("account_reference", ""))
                == normalized_reference
            ),
            None,
        )
    if matching_account is not None:
        matching_account.setdefault("bank", None)
        if normalized_iban and not normalize_account_reference(
            matching_account.get("iban", "")
        ):
            matching_account["iban"] = normalized_iban
            matching_account["updated_at"] = datetime.now(timezone.utc).isoformat()
        return matching_account, False

    now_iso = datetime.now(timezone.utc).isoformat()
    account = {
        "id": account_id_for_reference(normalized_reference),
        "label": f"Konto · {normalized_reference[-4:]}",
        "iban": normalized_iban or None,
        "account_reference": normalized_reference,
        "bank": None,
        "currency": "EUR",
        "owner_targets": [],
        "active": True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    accounts.append(account)
    return account, True


@dataclass(frozen=True, slots=True)
class Allocation:
    """A booking share assigned to a person or shared household target."""

    target: str
    amount: float
    area: str | None = None
    category: str | None = None
    project: str | None = None
    pet_id: str | None = None
    pet_name: str | None = None
    pet_type: str | None = None
    area_id: str | None = None
    category_id: str | None = None
    project_id: str | None = None


@dataclass(frozen=True, slots=True)
class Booking:
    """Normalized bank booking shared by both bank import formats."""

    account: str
    booking_date: date
    amount: float
    purpose: str = ""
    reference: str = ""
    counterparty: str = ""
    currency: str = "EUR"
    sender: str = ""


@dataclass(frozen=True, slots=True)
class ParsedBooking:
    booking: Booking
    source_data: dict[str, object]


@dataclass(frozen=True, slots=True)
class MonthSnapshot:
    plan: float
    forecast: float
    actual: float
    variance: float
    unresolved_total: float
    has_unresolved: bool


def _money(value: float | int | str | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def validate_allocations(total: float, allocations: list[Allocation]) -> list[str]:
    """Return validation codes when allocation shares do not cover a booking."""

    if not allocations:
        return ["missing_allocation"]
    allocated = sum((_money(item.amount) for item in allocations), Decimal("0.00"))
    expected = abs(_money(total))
    return [] if allocated == expected else ["amount_mismatch"]


def parse_allocation_payload(
    payload: object,
    total: float,
    valid_targets: set[str],
    valid_pets: dict[str, dict[str, object]] | set[str] | None = None,
) -> list[Allocation]:
    """Validate a custom allocation payload without rounding monetary input."""

    if not isinstance(payload, list) or not payload:
        raise ValueError("Die Aufteilung muss eine nicht leere Liste sein.")

    normalized: list[dict[str, object]] = []
    targets: set[str] = set()
    allocated_total = Decimal("0.00")
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError("Jeder Anteil muss ein Objekt sein.")

        target = item.get("target")
        if not isinstance(target, str) or not target.strip():
            raise ValueError("Jeder Anteil benötigt ein gültiges Ziel.")
        target = target.strip()
        if target not in valid_targets:
            raise ValueError("Eine Zuordnung verweist nicht auf eine bekannte Person.")
        if target in targets:
            raise ValueError("Jedes Zuordnungsziel darf nur einmal vorkommen.")
        targets.add(target)

        value = item.get("amount")
        if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
            raise ValueError("Jeder Anteil benötigt einen positiven Eurobetrag.")
        try:
            amount = Decimal(str(value))
        except InvalidOperation as exc:
            raise ValueError("Jeder Anteil benötigt einen positiven Eurobetrag.") from exc
        if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
            raise ValueError(
                "Beträge müssen positiv sein und dürfen höchstens zwei Nachkommastellen haben."
            )

        area = _optional_plan_text(item.get("area"), "Der Bereich")
        area_id = _optional_plan_text(item.get("area_id"), "Die Bereichs-ID", max_length=120)
        category = item.get("category")
        category_id = _optional_plan_text(item.get("category_id"), "Die Kategorie-ID", max_length=120)
        project = item.get("project")
        project_id = _optional_plan_text(item.get("project_id"), "Die Projekt-ID", max_length=120)
        if category is not None and not isinstance(category, str):
            raise ValueError("Die Kategorie muss eine Zeichenfolge sein.")
        if project is not None and not isinstance(project, str):
            raise ValueError("Das Projekt muss eine Zeichenfolge sein.")
        if isinstance(category, str):
            category = category.strip() or None
            if category is not None and len(category) > 120:
                raise ValueError("Die Kategorie darf höchstens 120 Zeichen enthalten.")
        if isinstance(project, str):
            project = project.strip() or None
            if project is not None and len(project) > 120:
                raise ValueError("Das Projekt darf höchstens 120 Zeichen enthalten.")

        pet_id = item.get("pet_id")
        pet_name = None
        pet_type = None
        if pet_id not in (None, ""):
            if not isinstance(pet_id, str) or not pet_id.strip():
                raise ValueError("Die Tierzuordnung ist ungültig.")
            pet_id = pet_id.strip()
            if valid_pets is None or pet_id not in valid_pets:
                raise ValueError("Die Tierzuordnung verweist nicht auf ein bekanntes Tier.")
            pet = valid_pets.get(pet_id) if isinstance(valid_pets, dict) else None
            if pet is not None:
                pet_name = _optional_plan_text(pet.get("name"), "Der Tiername", max_length=80)
                pet_type = _optional_plan_text(pet.get("pet_type"), "Der Tier-Typ", max_length=60)

        allocated_total += amount
        normalized.append(
            {
                "target": target,
                "amount": amount,
                "area": area,
                "area_id": area_id,
                "category": category,
                "category_id": category_id,
                "project": project,
                "project_id": project_id,
                "pet_id": pet_id,
                "pet_name": pet_name,
                "pet_type": pet_type,
            }
        )

    try:
        expected_total = abs(Decimal(str(total)))
    except InvalidOperation as exc:
        raise ValueError(
            "Die Aufteilung deckt den Buchungsbetrag nicht centgenau ab."
        ) from exc
    if not expected_total.is_finite() or allocated_total != expected_total:
        raise ValueError(
            "Die Aufteilung deckt den Buchungsbetrag nicht centgenau ab."
        )

    return [
        Allocation(
            target=str(item["target"]),
            amount=float(item["amount"]),
            area=item["area"],
            area_id=item["area_id"],
            category=item["category"],
            category_id=item["category_id"],
            project=item["project"],
            project_id=item["project_id"],
            pet_id=item["pet_id"],
            pet_name=item["pet_name"],
            pet_type=item["pet_type"],
        )
        for item in normalized
    ]


def split_amount(total: float, targets: list[str]) -> list[Allocation]:
    """Split a booking amount into positive cent-exact shares for its targets."""

    clean_targets = [target.strip() for target in targets if target.strip()]
    if not clean_targets or len(set(clean_targets)) != len(clean_targets):
        raise ValueError("At least one unique allocation target is required")
    cents = int(abs(_money(total)) * 100)
    base, remainder = divmod(cents, len(clean_targets))
    return [
        Allocation(
            target=target,
            amount=float(Decimal(base + (index < remainder)) / Decimal("100")),
        )
        for index, target in enumerate(clean_targets)
    ]


def _normalized_match_text(value: object, label: str, *, required: bool) -> str | None:
    if value is None:
        if required:
            raise ValueError(f"{label} muss als Text angegeben werden.")
        return None
    if not isinstance(value, str):
        raise ValueError(f"{label} muss als Text angegeben werden.")
    normalized = " ".join(value.split())
    if not normalized:
        if required:
            raise ValueError(f"{label} darf nicht leer sein.")
        return None
    return normalized


def _normalized_rule_text(
    value: object, label: str, *, required: bool, max_length: int = 120,
) -> str | None:
    normalized = _normalized_match_text(value, label, required=required)
    if normalized is not None and len(normalized) > max_length:
        raise ValueError(f"{label} darf höchstens {max_length} Zeichen enthalten.")
    return normalized


def _rule_priority(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 1000:
        raise ValueError("Die Regelpriorität muss eine ganze Zahl von 0 bis 1000 sein.")
    return value


def _active_reference(
    reference_id: str,
    references: dict[str, dict[str, object]],
    label: str,
) -> None:
    reference = references.get(reference_id)
    if reference is None or reference.get("active") is False:
        raise ValueError(f"{label} verweist nicht auf einen aktiven Eintrag.")


def _active_catalog_references(
    catalogs: dict[str, list[dict[str, object]]], kind: str,
) -> dict[str, dict[str, object]]:
    entries = catalogs.get(kind, [])
    if not isinstance(entries, list):
        return {}
    return {
        entry["id"]: entry
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("id"), str)
    }


def _rule_share_percent(value: object) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("Der prozentuale Anteil muss als Zahl angegeben werden.")
    try:
        share = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("Der prozentuale Anteil muss als Zahl angegeben werden.") from exc
    if not share.is_finite() or not Decimal("0.01") <= share <= Decimal("100.00"):
        raise ValueError("Der prozentuale Anteil muss zwischen 0,01 und 100,00 liegen.")
    if share != share.quantize(Decimal("0.01")):
        raise ValueError("Der prozentuale Anteil darf höchstens zwei Nachkommastellen haben.")
    return share


def validate_rule_payload(
    payload: object,
    *,
    valid_targets: set[str],
    accounts: dict[str, dict[str, object]],
    catalogs: dict[str, list[dict[str, object]]],
    pets: dict[str, dict[str, object]],
    partial: bool = False,
) -> dict[str, object]:
    """Validate one persisted booking-rule payload and normalize its fields."""

    if not isinstance(payload, dict):
        raise ValueError("Die Regeldaten müssen ein Objekt sein.")
    unknown = set(payload) - RULE_FIELDS
    if unknown:
        raise ValueError("Die Regeldaten enthalten ein unbekanntes Feld.")

    normalized: dict[str, object] = {}
    if not partial or "label" in payload:
        normalized["label"] = _normalized_rule_text(
            payload.get("label"), "Die Regelbezeichnung", required=True
        )
    if not partial or "active" in payload:
        active = payload.get("active", True)
        if not isinstance(active, bool):
            raise ValueError("Der Aktivstatus muss ein boolescher Wert sein.")
        normalized["active"] = active
    if not partial or "priority" in payload:
        normalized["priority"] = _rule_priority(payload.get("priority", 100))
    if not partial or "account_id" in payload:
        account_id = _normalized_rule_text(
            payload.get("account_id"), "Die Konto-ID", required=False
        )
        if account_id is not None:
            _active_reference(account_id, accounts, "Die Konto-ID")
        normalized["account_id"] = account_id
    if not partial or "counterparty" in payload:
        normalized["counterparty"] = _normalized_rule_text(
            payload.get("counterparty"), "Der Zahlungsempfänger", required=False, max_length=160
        )
    if not partial or "purpose_contains" in payload:
        normalized["purpose_contains"] = _normalized_rule_text(
            payload.get("purpose_contains"), "Der Verwendungszweckfilter", required=False, max_length=160
        )
    if not partial and all(normalized.get(field) is None for field in ("account_id", "counterparty", "purpose_contains")):
        raise ValueError("Eine Regel benötigt mindestens eine Bedingung.")
    if not partial or "allocations" in payload:
        allocations = payload.get("allocations")
        if not isinstance(allocations, list) or not allocations:
            raise ValueError("Die Regelaufteilung muss eine nicht leere Liste sein.")
        seen_targets: set[str] = set()
        total_share = Decimal("0")
        normalized_allocations: list[dict[str, object]] = []
        catalog_references = {
            kind: _active_catalog_references(catalogs, kind) for kind in CATALOG_KINDS
        }
        for allocation in allocations:
            if not isinstance(allocation, dict):
                raise ValueError("Jeder Regelanteil muss ein Objekt sein.")
            unknown_allocation = set(allocation) - RULE_ALLOCATION_FIELDS
            if unknown_allocation:
                raise ValueError("Ein Regelanteil enthält ein unbekanntes Feld.")
            target = _normalized_rule_text(
                allocation.get("target"), "Das Aufteilungsziel", required=True
            )
            if target not in valid_targets:
                raise ValueError("Eine Zuordnung verweist nicht auf eine bekannte Person.")
            if target in seen_targets:
                raise ValueError("Jedes Zuordnungsziel darf nur einmal vorkommen.")
            seen_targets.add(target)
            share_percent = _rule_share_percent(allocation.get("share_percent"))
            total_share += share_percent

            normalized_allocation: dict[str, object] = {
                "target": target,
                "share_percent": float(share_percent),
            }
            for field, kind, label in (
                ("area_id", "areas", "Die Bereichs-ID"),
                ("category_id", "categories", "Die Kategorie-ID"),
                ("project_id", "projects", "Die Projekt-ID"),
            ):
                reference_id = _normalized_rule_text(
                    allocation.get(field), label, required=False
                )
                if reference_id is not None:
                    _active_reference(reference_id, catalog_references[kind], label)
                normalized_allocation[field] = reference_id
            pet_id = _normalized_rule_text(
                allocation.get("pet_id"), "Die Tier-ID", required=False
            )
            if pet_id is not None:
                _active_reference(pet_id, pets, "Die Tier-ID")
            normalized_allocation["pet_id"] = pet_id
            normalized_allocations.append(normalized_allocation)
        if total_share != Decimal("100"):
            raise ValueError("Die Regelanteile müssen zusammen genau 100 Prozent ergeben.")
        normalized["allocations"] = normalized_allocations
    return normalized


def _rule_matches_booking(rule: dict[str, object], booking: dict[str, object]) -> bool:
    account_id = rule.get("account_id")
    if account_id not in (None, "") and account_id != booking.get("account_id"):
        return False
    counterparty = _normalized_match_text(
        booking.get("counterparty"), "Der Zahlungsempfänger", required=False
    )
    rule_counterparty = rule.get("counterparty")
    if rule_counterparty not in (None, ""):
        if counterparty is None or not isinstance(rule_counterparty, str) or rule_counterparty.casefold() != counterparty.casefold():
            return False
    purpose_contains = rule.get("purpose_contains")
    if purpose_contains in (None, ""):
        return True
    purpose = _normalized_match_text(
        booking.get("purpose"), "Der Verwendungszweck", required=False
    )
    return isinstance(purpose_contains, str) and purpose is not None and (
        purpose_contains.casefold() in purpose.casefold()
    )


def _materialize_rule_allocations(
    amount: object, allocations: list[dict[str, object]]
) -> list[dict[str, object]] | None:
    try:
        total = abs(_money(amount))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError("Der Buchungsbetrag ist ungültig.") from exc
    if int(total * 100) < len(allocations):
        return None

    amounts: list[Decimal] = []
    materialized: list[dict[str, object]] = []
    for allocation in allocations:
        share_amount = (total * Decimal(str(allocation["share_percent"])) / Decimal("100")).quantize(
            MONEY_QUANT, rounding=ROUND_HALF_UP
        )
        amounts.append(max(MONEY_QUANT, share_amount))

    remainder = total - sum(amounts, Decimal("0.00"))
    if remainder >= 0:
        amounts[0] += remainder
    else:
        remaining = -remainder
        for index, share_amount in enumerate(amounts):
            reduction = min(share_amount - MONEY_QUANT, remaining)
            amounts[index] = share_amount - reduction
            remaining -= reduction
            if remaining == 0:
                break
        if remaining != 0:
            return None

    for allocation, share_amount in zip(allocations, amounts, strict=True):
        materialized.append({**allocation, "amount": float(share_amount)})
    return materialized


def _unresolved_rule_suggestion(reason: str) -> dict[str, object]:
    return {
        "status": "unresolved",
        "suggestion": None,
        "conflicts": [],
        "reason": reason,
    }


def rule_suggestion(
    booking: dict[str, object],
    rules: list[dict[str, object]],
    *,
    accounts: dict[str, dict[str, object]],
    valid_targets: set[str],
    catalogs: dict[str, list[dict[str, object]]],
    pets: dict[str, dict[str, object]],
) -> dict[str, object]:
    """Project the one unambiguous active rule suggestion for a booking."""

    if not isinstance(booking, dict) or not isinstance(rules, list):
        return _unresolved_rule_suggestion("Die Buchungs- oder Regeldaten sind ungültig.")
    try:
        if abs(_money(booking.get("amount", 0))) <= 0:
            return _unresolved_rule_suggestion("Der Buchungsbetrag muss positiv sein.")
    except (InvalidOperation, ValueError, TypeError):
        return _unresolved_rule_suggestion("Der Buchungsbetrag ist ungültig.")
    try:
        normalized_booking = {
            **booking,
            "account_id": _normalized_match_text(
                booking.get("account_id"), "Die Konto-ID", required=False
            ),
            "counterparty": _normalized_match_text(
                booking.get("counterparty"), "Der Zahlungsempfänger", required=False
            ),
            "purpose": _normalized_match_text(
                booking.get("purpose"), "Der Verwendungszweck", required=False
            ),
        }
    except ValueError:
        return _unresolved_rule_suggestion(
            "Die Matching-Felder der Buchung sind ungültig."
        )
    matches: list[tuple[dict[str, object], dict[str, object]]] = []
    for rule in rules:
        if not isinstance(rule, dict) or rule.get("active") is not True:
            continue
        try:
            # Establish matches and priority before validating allocation references.
            # A broken winning rule must stay visible instead of enabling fallback.
            normalized = {
                "priority": _rule_priority(rule.get("priority", 100)),
                "account_id": _normalized_match_text(
                    rule.get("account_id"), "Die Konto-ID", required=False
                ),
                "counterparty": _normalized_match_text(
                    rule.get("counterparty"), "Der Zahlungsempfänger", required=False
                ),
                "purpose_contains": _normalized_match_text(
                    rule.get("purpose_contains"), "Der Verwendungszweckfilter", required=False
                ),
            }
        except ValueError:
            continue
        if _rule_matches_booking(normalized, normalized_booking):
            matches.append((rule, normalized))
    if not matches:
        return _unresolved_rule_suggestion("Keine aktive Regel passt zu dieser Buchung.")
    matches.sort(key=lambda match: (-int(match[1]["priority"]), str(match[0].get("id", ""))))
    highest_priority = matches[0][1]["priority"]
    highest_matches = [match for match in matches if match[1]["priority"] == highest_priority]
    validated_matches = []
    errors = []
    for rule, _ in highest_matches:
        try:
            normalized = validate_rule_payload(
                {field: rule.get(field) for field in RULE_FIELDS},
                valid_targets=valid_targets, accounts=accounts, catalogs=catalogs, pets=pets,
            )
        except ValueError as exc:
            errors.append(f"Regel „{rule.get('label') or rule.get('id', '')}“: {exc}")
        else:
            validated_matches.append((rule, normalized))
    if errors:
        return _unresolved_rule_suggestion(" ".join(errors))
    if len(highest_matches) > 1:
        return {
            "status": "conflict",
            "suggestion": None,
            "conflicts": [str(match[0].get("id", "")) for match in highest_matches],
        }
    rule, normalized = validated_matches[0]
    allocations = _materialize_rule_allocations(
        booking.get("amount"), normalized["allocations"]
    )
    if allocations is None:
        return _unresolved_rule_suggestion(
            "Die Regelaufteilung kann für diesen Buchungsbetrag nicht positiv in Cent materialisiert werden."
        )
    account_id = normalized["account_id"]
    account_condition = (
        f"Konto „{accounts[account_id].get('label') or account_id}“"
        if account_id is not None else "Alle Konten (keine Kontobedingung)"
    )
    reason = f"{account_condition}."
    if normalized["counterparty"]:
        reason += f" Zahlungsempfänger „{normalized['counterparty']}“ stimmt überein."
    if normalized["purpose_contains"]:
        reason += f" Verwendungszweck enthält „{normalized['purpose_contains']}“."
    return {
        "status": "suggested",
        "suggestion": {
            "rule_id": str(rule.get("id", "")),
            "rule_label": normalized["label"],
            "reason": reason,
            "allocations": allocations,
        },
        "conflicts": [],
    }


def rule_payload_from_booking(booking: dict[str, object]) -> dict[str, object]:
    """Create a reusable rule template from confirmed booking allocations."""

    if not isinstance(booking, dict):
        raise ValueError("Die Buchungsdaten müssen ein Objekt sein.")
    allocations = booking.get("allocations")
    if not isinstance(allocations, list) or not allocations:
        raise ValueError("Die Buchung benötigt bestätigte Aufteilungen.")
    total = abs(_money(booking.get("amount", sum(
        _money(item.get("amount", 0)) for item in allocations if isinstance(item, dict)
    ))))
    if total <= 0:
        raise ValueError("Die Buchung benötigt einen positiven Betrag.")
    template_allocations: list[dict[str, object]] = []
    assigned = Decimal("0")
    for allocation in allocations:
        if not isinstance(allocation, dict):
            raise ValueError("Jeder Buchungsanteil muss ein Objekt sein.")
        amount = _money(allocation.get("amount", 0))
        if amount <= 0:
            raise ValueError("Jeder Buchungsanteil benötigt einen positiven Betrag.")
        share = (amount / total * Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        assigned += share
        template_allocations.append(
            {
                "target": allocation.get("target"),
                "share_percent": float(share),
                "area_id": allocation.get("area_id"),
                "category_id": allocation.get("category_id"),
                "project_id": allocation.get("project_id"),
                "pet_id": allocation.get("pet_id"),
            }
        )
    template_allocations[0]["share_percent"] = float(
        Decimal(str(template_allocations[0]["share_percent"])) + Decimal("100") - assigned
    )
    counterparty = _normalized_match_text(
        booking.get("counterparty"), "Der Zahlungsempfänger", required=False
    )
    purpose = _normalized_match_text(
        booking.get("purpose"), "Der Verwendungszweck", required=False
    )
    return {
        "label": counterparty or (purpose[:120] if purpose else "Buchungsregel"),
        "active": True,
        "priority": 100,
        "account_id": _normalized_match_text(
            booking.get("account_id"), "Die Konto-ID", required=False
        ),
        "counterparty": counterparty,
        "purpose_contains": None,
        "allocations": template_allocations,
    }


def month_snapshot(
    *,
    planned_total: float,
    actual_total: float,
    planned_remaining: float,
    unresolved_total: float,
) -> MonthSnapshot:
    """Build the overview numbers without mixing unresolved bookings into the forecast."""

    plan = _money(planned_total)
    actual = _money(actual_total)
    forecast = _money(actual + _money(planned_remaining))
    variance = _money(forecast - plan)
    unresolved = abs(_money(unresolved_total))
    return MonthSnapshot(
        plan=float(plan),
        forecast=float(forecast),
        actual=float(actual),
        variance=float(variance),
        unresolved_total=float(unresolved),
        has_unresolved=unresolved > 0,
    )


def signed_plan_amount(item: dict[str, object]) -> float:
    """Return a plan amount with imported positive values in balance direction."""

    amount = float(item.get("amount", 0))
    direction = item.get("direction")
    if direction == "income":
        return abs(amount)
    if direction in {"expense", "saving"}:
        return -abs(amount)
    return amount


def _month_window(month: str) -> tuple[date, date]:
    """Return the first and last day represented by an ISO month value."""

    match = re.fullmatch(r"(\d{4})-(\d{2})", str(month))
    if match is None:
        raise ValueError("Der Monat muss im Format JJJJ-MM angegeben werden.")
    year, month_number = (int(value) for value in match.groups())
    if not 1 <= month_number <= 12:
        raise ValueError("Der Monat muss zwischen 01 und 12 liegen.")
    first = date(year, month_number, 1)
    if month_number == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month_number + 1, 1)
    return first, next_month.fromordinal(next_month.toordinal() - 1)


def _stored_plan_date(value: object) -> date | None:
    """Read a persisted plan date without making malformed legacy data fatal."""

    if isinstance(value, date):
        return value
    if not isinstance(value, str) or not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _feed_purchase_dates(profile: dict[str, object]) -> list[date]:
    """Return valid, unique purchase dates from current and legacy fields."""

    values: list[object] = []
    history = profile.get("purchase_dates", [])
    if isinstance(history, list):
        values.extend(history)
    values.append(profile.get("last_purchase_date"))
    dates = {
        parsed
        for value in values
        if (parsed := _stored_plan_date(value)) is not None
    }
    return sorted(dates)


def feed_profile_forecast(
    profile: dict[str, object], *, today: date | None = None
) -> dict[str, object]:
    """Calculate a transparent next-purchase estimate for one feed profile."""

    reference_date = today or date.today()
    purchases = _feed_purchase_dates(profile)
    last_purchase = purchases[-1] if purchases else None
    average_interval_weeks: float | None = None
    if len(purchases) >= 2:
        average_days = (purchases[-1] - purchases[0]).days / (len(purchases) - 1)
        average_interval_weeks = round(average_days / 7, 2)

    manual_interval = profile.get("interval_weeks")
    if isinstance(manual_interval, (int, float, Decimal)) and not isinstance(manual_interval, bool):
        effective_interval = float(manual_interval)
        interval_source = "manual"
    elif average_interval_weeks is not None:
        effective_interval = average_interval_weeks
        interval_source = "average"
    else:
        effective_interval = None
        interval_source = "none"

    next_purchase: date | None = None
    if last_purchase is not None and effective_interval is not None:
        interval_days = max(1, int(Decimal(str(effective_interval)) * 7 + Decimal("0.5")))
        next_purchase = last_purchase + timedelta(days=interval_days)

    due_soon_days = profile.get("due_soon_days", 14)
    if isinstance(due_soon_days, bool) or not isinstance(due_soon_days, int):
        due_soon_days = 14
    if next_purchase is None:
        status = "planned"
        days_until = None
    else:
        days_until = (next_purchase - reference_date).days
        if days_until < 0:
            status = "overdue"
        elif days_until == 0:
            status = "due"
        elif days_until <= due_soon_days:
            status = "due_soon"
        else:
            status = "planned"

    return {
        "last_purchase_date": last_purchase.isoformat() if last_purchase else None,
        "purchase_count": len(purchases),
        "average_interval_weeks": average_interval_weeks,
        "effective_interval_weeks": effective_interval,
        "interval_source": interval_source,
        "next_purchase_date": next_purchase.isoformat() if next_purchase else None,
        "status": status,
        "days_until_purchase": days_until,
    }


def record_feed_profile_purchase(
    profile: dict[str, object],
    purchase_date: object = None,
    *,
    today: date | None = None,
) -> str:
    """Record one confirmed purchase and return its normalized ISO date."""

    if profile.get("active", True) is False:
        raise ValueError(
            "Ein archiviertes Futterprofil muss vor dem Kauf reaktiviert werden."
        )
    reference_date = today or date.today()
    normalized_date = (
        reference_date.isoformat()
        if purchase_date in (None, "")
        else purchase_date.strip()
        if isinstance(purchase_date, str)
        else None
    )
    if not normalized_date:
        raise ValueError("Bitte ein Kaufdatum im Format JJJJ-MM-TT angeben.")
    try:
        parsed_purchase_date = date.fromisoformat(normalized_date)
    except ValueError as exc:
        raise ValueError(
            "Das Kaufdatum muss im Format JJJJ-MM-TT angegeben werden."
        ) from exc
    if parsed_purchase_date.isoformat() != normalized_date:
        raise ValueError(
            "Das Kaufdatum muss im Format JJJJ-MM-TT angegeben werden."
        )
    if parsed_purchase_date > reference_date:
        raise ValueError("Das Kaufdatum darf nicht in der Zukunft liegen.")

    history = profile.get("purchase_dates", [])
    history_values = history if isinstance(history, list) else []
    purchase_dates = {
        value
        for value in history_values
        if isinstance(value, str)
        and _stored_plan_date(value) is not None
    }
    purchase_dates.add(normalized_date)
    profile["purchase_dates"] = sorted(purchase_dates)
    profile["last_purchase_date"] = profile["purchase_dates"][-1]
    return normalized_date


def feed_profile_month_values(
    profile: dict[str, object], month: str, *, today: date | None = None
) -> tuple[float, float]:
    """Return ``(monthly_budget, scheduled_cashflow)`` for a feed estimate.

    Feed profiles are concrete forecast events, not normalized monthly plan
    items. Their budget contribution is therefore zero, avoiding double count.
    """

    if not profile.get("active", True):
        return 0.0, 0.0
    forecast = feed_profile_forecast(profile, today=today)
    next_purchase = _stored_plan_date(forecast["next_purchase_date"])
    if next_purchase is None:
        return 0.0, 0.0
    month_start, month_end = _month_window(month)
    if not month_start <= next_purchase <= month_end:
        return 0.0, 0.0
    return 0.0, -float(_money(profile.get("expected_cost", 0)))


def _plan_item_occurs_in_month(
    item: dict[str, object],
    month_start: date,
    month_end: date,
    frequency_months: int | None,
) -> bool:
    """Return whether a plan item's concrete payment falls in a month."""

    start = _stored_plan_date(item.get("start_date"))
    end = _stored_plan_date(item.get("end_date"))
    if start and month_end < start or end and month_start > end:
        return False

    due_date = _stored_plan_date(item.get("due_date"))
    if frequency_months is None:
        payment_date = due_date or start
        return payment_date is not None and month_start <= payment_date <= month_end

    anchor = due_date or start
    if anchor:
        if anchor > month_end:
            return False
        month_delta = (month_start.year - anchor.year) * 12 + month_start.month - anchor.month
        return month_delta >= 0 and month_delta % frequency_months == 0

    # A due day is enough to anchor an interval to January without inventing a
    # concrete year. This makes quarterly/annual legacy entries deterministic.
    due_day = item.get("due_day")
    if due_day not in (None, ""):
        return (month_start.month - 1) % frequency_months == 0

    # Legacy monthly entries have always contributed to every month. For a
    # longer rhythm without an anchor, keep the normalized budget value but do
    # not claim a concrete cash-flow date that the data does not provide.
    return frequency_months == 1


def plan_item_month_values(
    item: dict[str, object], month: str
) -> tuple[float, float]:
    """Return ``(monthly_plan, scheduled_cashflow)`` for one plan item.

    The first value is the normalized budget contribution. The second value is
    the concrete amount still expected in the selected month. Both values are
    signed according to the plan direction.
    """

    month_start, month_end = _month_window(month)
    if not item.get("active", True):
        return 0.0, 0.0

    amount = abs(_money(item.get("amount", 0)))
    remaining_value = item.get("remaining_amount", item.get("amount", 0))
    if remaining_value is None:
        remaining_value = item.get("amount", 0)
    remaining = abs(_money(remaining_value))

    frequency = item.get("frequency_months", 1)
    if frequency is not None and (
        isinstance(frequency, bool) or not isinstance(frequency, int) or frequency <= 0
    ):
        frequency = 1

    occurs = _plan_item_occurs_in_month(item, month_start, month_end, frequency)
    if frequency is None:
        budget = amount if occurs else Decimal("0.00")
    else:
        start = _stored_plan_date(item.get("start_date"))
        end = _stored_plan_date(item.get("end_date"))
        if start and month_end < start or end and month_start > end:
            budget = Decimal("0.00")
        else:
            budget = (amount / Decimal(frequency)).quantize(
                MONEY_QUANT, rounding=ROUND_HALF_UP
            )

    signed_budget = signed_plan_amount({**item, "amount": float(budget)})
    signed_scheduled = signed_plan_amount(
        {**item, "amount": float(remaining if occurs else Decimal("0.00"))}
    )
    return signed_budget, signed_scheduled


def overview_values(data: dict[str, object], month: str) -> dict[str, float | int]:
    """Calculate the compact overview contract used by the panel and HA sensors."""

    plan_items = [
        item
        for item in data.get("plan_items", [])
        if isinstance(item, dict) and item.get("active", True)
    ]
    bookings = [
        item for item in data.get("bookings", []) if isinstance(item, dict)
    ]
    plan_values = [plan_item_month_values(item, month) for item in plan_items]
    plan = sum(monthly_plan for monthly_plan, _ in plan_values)
    actual = sum(
        float(item.get("amount", 0))
        for item in bookings
        if str(item.get("booking_date", "")).startswith(month)
    )
    planned_remaining = sum(
        scheduled_cashflow for _, scheduled_cashflow in plan_values
    )
    feed_profiles = data.get("feed_profiles", [])
    if not isinstance(feed_profiles, list):
        feed_profiles = []
    feed_forecast_total = sum(
        scheduled_cashflow
        for profile in feed_profiles
        if isinstance(profile, dict)
        for _, scheduled_cashflow in [feed_profile_month_values(profile, month)]
    )
    planned_remaining += feed_forecast_total
    unresolved = [item for item in bookings if item.get("status") != "resolved"]
    snapshot = month_snapshot(
        planned_total=plan,
        actual_total=actual,
        planned_remaining=planned_remaining,
        unresolved_total=sum(float(item.get("amount", 0)) for item in unresolved),
    )
    return {
        "plan": snapshot.plan,
        "forecast": snapshot.forecast,
        "actual": snapshot.actual,
        "variance": snapshot.variance,
        "unresolved_total": snapshot.unresolved_total,
        "unresolved_count": len(unresolved),
        "planned_balance": snapshot.plan,
        "actual_balance": snapshot.actual,
        "unresolved_bookings": len(unresolved),
        "feed_forecast_total": float(feed_forecast_total),
    }


def _overview_catalog_labels(data: dict[str, object], kind: str) -> dict[str, str]:
    """Return stable catalog IDs and their current labels for an overview."""

    catalogs = data.get("catalogs")
    entries = catalogs.get(kind, []) if isinstance(catalogs, dict) else []
    if not isinstance(entries, list):
        return {}
    return {
        str(entry.get("id")): str(entry.get("label")).strip()
        for entry in entries
        if isinstance(entry, dict)
        and entry.get("id")
        and isinstance(entry.get("label"), str)
        and entry.get("label", "").strip()
    }


def _overview_dimension_label(
    value: object,
    identifier: object,
    labels: dict[str, str],
) -> str:
    """Resolve a current catalog label while keeping legacy name snapshots."""

    if identifier not in (None, "") and str(identifier) in labels:
        return labels[str(identifier)]
    if isinstance(value, str) and value.strip():
        return value.strip()
    return "Nicht zugeordnet"


def _overview_booking_date(booking: dict[str, object]) -> date | None:
    value = booking.get("booking_date")
    if isinstance(value, date):
        return value
    if not isinstance(value, str) or not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _overview_booking_amount(booking: dict[str, object]) -> Decimal:
    try:
        return _money(booking.get("amount", 0))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0.00")


class _OverviewComparisonGroup(TypedDict):
    name: str
    plan: Decimal
    scheduled: Decimal
    actual: Decimal


def _overview_comparison_dimension(
    values: dict[str, object],
    kind: str,
    labels: dict[str, str],
) -> tuple[str, str]:
    """Return the stable comparison key and display label for one dimension."""

    field = CATALOG_VALUE_FIELDS[kind]
    identifier = values.get(f"{field}_id")
    if identifier in (None, ""):
        return "__unassigned__", "Nicht zugeordnet"
    key = str(identifier)
    return key, _overview_dimension_label(values.get(field), identifier, labels)


def _overview_comparison_values(
    groups: dict[str, _OverviewComparisonGroup],
    key: str,
    name: str,
) -> _OverviewComparisonGroup:
    """Return a comparison group, creating it with its stable display name."""

    return groups.setdefault(
        key,
        {
            "name": name,
            "plan": Decimal("0.00"),
            "scheduled": Decimal("0.00"),
            "actual": Decimal("0.00"),
        },
    )


def _overview_comparison_entries(
    groups: dict[str, _OverviewComparisonGroup],
) -> list[dict[str, object]]:
    """Serialize the twelve most material comparison groups."""

    entries: list[dict[str, object]] = []
    for key, values in groups.items():
        plan = _money(values["plan"])
        actual = _money(values["actual"])
        forecast = _money(actual + values["scheduled"])
        if plan == 0 and actual == 0 and forecast == 0:
            continue
        variance = _money(actual - plan)
        forecast_variance = _money(forecast - plan)
        variance_percent = (
            None
            if plan == 0
            else float(
                (variance / abs(plan) * Decimal("100")).quantize(
                    MONEY_QUANT, rounding=ROUND_HALF_UP
                )
            )
        )
        name = values["name"]
        entries.append(
            {
                "key": key,
                "name": name,
                "plan": float(plan),
                "forecast": float(forecast),
                "actual": float(actual),
                "variance": float(variance),
                "forecast_variance": float(forecast_variance),
                "variance_percent": variance_percent,
            }
        )
    entries.sort(
        key=lambda entry: (
            -max(abs(entry["plan"]), abs(entry["forecast"]), abs(entry["actual"])),
            entry["name"].casefold(),
            entry["key"],
        )
    )
    return entries[:12]


def overview_comparison(
    data: dict[str, object],
    month: str,
    *,
    today: date | None = None,
) -> dict[str, list[dict[str, object]]]:
    """Project monthly plan, forecast and actual values by catalog dimension."""

    labels = {kind: _overview_catalog_labels(data, kind) for kind in CATALOG_KINDS}
    groups: dict[str, dict[str, _OverviewComparisonGroup]] = {
        kind: {} for kind in CATALOG_KINDS
    }

    plan_items = data.get("plan_items", [])
    if isinstance(plan_items, list):
        for item in plan_items:
            if not isinstance(item, dict) or not item.get("active", True):
                continue
            plan, scheduled = plan_item_month_values(item, month)
            for kind in CATALOG_KINDS:
                key, name = _overview_comparison_dimension(item, kind, labels[kind])
                values = _overview_comparison_values(groups[kind], key, name)
                values["name"] = name
                values["plan"] += _money(plan)
                values["scheduled"] += _money(scheduled)

    month_start, month_end = _month_window(month)
    bookings = data.get("bookings", [])
    if isinstance(bookings, list):
        for booking in bookings:
            if not isinstance(booking, dict):
                continue
            booking_date = _overview_booking_date(booking)
            if booking_date is None or not month_start <= booking_date <= month_end:
                continue
            amount = _overview_booking_amount(booking)
            allocated = Decimal("0.00")
            allocations = booking.get("allocations")
            if isinstance(allocations, list):
                for allocation in allocations:
                    if not isinstance(allocation, dict):
                        continue
                    try:
                        share = abs(_money(allocation.get("amount", 0)))
                    except (InvalidOperation, ValueError, TypeError):
                        continue
                    if share == 0:
                        continue
                    allocated += share
                    signed_share = share if amount >= 0 else -share
                    for kind in CATALOG_KINDS:
                        key, name = _overview_comparison_dimension(
                            allocation, kind, labels[kind]
                        )
                        values = _overview_comparison_values(groups[kind], key, name)
                        values["name"] = name
                        values["actual"] += signed_share
            remainder = max(Decimal("0.00"), abs(amount) - allocated)
            if remainder:
                signed_remainder = remainder if amount >= 0 else -remainder
                for kind in CATALOG_KINDS:
                    values = _overview_comparison_values(
                        groups[kind], "__unassigned__", "Nicht zugeordnet"
                    )
                    values["name"] = "Nicht zugeordnet"
                    values["actual"] += signed_remainder

    feed_profiles = data.get("feed_profiles", [])
    if isinstance(feed_profiles, list):
        for profile in feed_profiles:
            if not isinstance(profile, dict):
                continue
            _, scheduled = feed_profile_month_values(profile, month, today=today)
            if not scheduled:
                continue
            for kind in CATALOG_KINDS:
                values = _overview_comparison_values(
                    groups[kind], "__unassigned__", "Nicht zugeordnet"
                )
                values["name"] = "Nicht zugeordnet"
                values["scheduled"] += _money(scheduled)

    return {kind: _overview_comparison_entries(groups[kind]) for kind in CATALOG_KINDS}


def _overview_breakdown_dimension(dimension: str) -> str:
    """Normalize one supported overview comparison dimension."""

    normalized = dimension.strip() if isinstance(dimension, str) else ""
    if normalized not in CATALOG_KINDS:
        raise ValueError("Die Dimension muss Bereiche, Kategorien oder Projekte sein.")
    return normalized


def overview_breakdown(
    data: dict[str, object],
    month: str,
    dimension: str,
    key: str,
) -> dict[str, object]:
    """Return the records contributing to one monthly comparison entry."""

    kind = _overview_breakdown_dimension(dimension)
    normalized_key = key.strip() if isinstance(key, str) else ""
    if not normalized_key:
        raise ValueError("Bitte einen Vergleichsschlüssel angeben.")

    comparison = overview_comparison(data, month)
    entry = next(
        (
            value
            for value in comparison[kind]
            if value.get("key") == normalized_key
        ),
        None,
    )
    if entry is None:
        raise ValueError("Der Vergleichseintrag ist nicht verfügbar.")

    labels = _overview_catalog_labels(data, kind)
    plan_items: list[dict[str, object]] = []
    stored_plan_items = data.get("plan_items", [])
    if isinstance(stored_plan_items, list):
        for item in stored_plan_items:
            if not isinstance(item, dict) or not item.get("active", True):
                continue
            item_key, _ = _overview_comparison_dimension(item, kind, labels)
            plan, scheduled = plan_item_month_values(item, month)
            if item_key == normalized_key and (plan or scheduled):
                plan_items.append(dict(item))

    month_start, month_end = _month_window(month)
    bookings: list[dict[str, object]] = []
    stored_bookings = data.get("bookings", [])
    if isinstance(stored_bookings, list):
        for booking in stored_bookings:
            if not isinstance(booking, dict):
                continue
            booking_date = _overview_booking_date(booking)
            if booking_date is None or not month_start <= booking_date <= month_end:
                continue

            amount = _overview_booking_amount(booking)
            allocated = Decimal("0.00")
            matched = Decimal("0.00")
            allocations = booking.get("allocations")
            if isinstance(allocations, list):
                for allocation in allocations:
                    if not isinstance(allocation, dict):
                        continue
                    try:
                        share = abs(_money(allocation.get("amount", 0)))
                    except (InvalidOperation, ValueError, TypeError):
                        continue
                    if share == 0:
                        continue
                    allocated += share
                    allocation_key, _ = _overview_comparison_dimension(
                        allocation, kind, labels
                    )
                    if allocation_key == normalized_key:
                        matched += share if amount >= 0 else -share

            if normalized_key == "__unassigned__":
                remainder = max(Decimal("0.00"), abs(amount) - allocated)
                matched += remainder if amount >= 0 else -remainder
            if matched:
                bookings.append({**dict(booking), "matched_amount": float(_money(matched))})

    return {
        "month": month,
        "dimension": kind,
        "key": normalized_key,
        "name": entry["name"],
        "plan_items": plan_items,
        "bookings": bookings,
    }


def _overview_breakdown(
    groups: dict[str, dict[str, Decimal]],
    *,
    limit: int,
) -> list[dict[str, object]]:
    """Serialize the largest Plan/Ist groups for the overview cards."""

    entries = []
    for name, values in groups.items():
        plan = float(_money(values["plan"]))
        actual = float(_money(values["actual"]))
        if plan == 0 and actual == 0:
            continue
        entries.append(
            {
                "name": name,
                "value": actual,
                "plan": plan,
                "actual": actual,
                "variance": float(_money(actual - plan)),
            }
        )
    entries.sort(key=lambda entry: (-max(abs(entry["actual"]), abs(entry["plan"])), entry["name"].casefold()))
    return entries[:limit]


def _overview_plan_payment_date(
    item: dict[str, object],
    month_start: date,
    month_end: date,
) -> date:
    """Choose a deterministic day for a concrete plan event in a month."""

    due_date = _stored_plan_date(item.get("due_date"))
    if due_date and month_start <= due_date <= month_end:
        return due_date
    start_date = _stored_plan_date(item.get("start_date"))
    if start_date and month_start <= start_date <= month_end:
        return start_date
    due_day = item.get("due_day")
    if isinstance(due_day, int) and not isinstance(due_day, bool):
        return month_start + timedelta(days=min(due_day, month_end.day) - 1)
    return month_start


def _overview_breakdown_groups(
    data: dict[str, object],
    month: str,
) -> tuple[
    dict[str, dict[str, Decimal]],
    dict[str, dict[str, Decimal]],
    dict[str, Decimal],
    dict[str, Decimal],
]:
    """Aggregate plan items and bookings by area/category and household type."""

    area_labels = _overview_catalog_labels(data, "areas")
    category_labels = _overview_catalog_labels(data, "categories")
    area_groups: dict[str, dict[str, Decimal]] = {}
    category_groups: dict[str, dict[str, Decimal]] = {}
    planned_by_direction = {
        "income": Decimal("0.00"),
        "expense": Decimal("0.00"),
        "saving": Decimal("0.00"),
    }
    actual_by_direction = {
        "income": Decimal("0.00"),
        "expense": Decimal("0.00"),
        "saving": Decimal("0.00"),
    }

    plan_items = data.get("plan_items", [])
    if isinstance(plan_items, list):
        for item in plan_items:
            if not isinstance(item, dict) or not item.get("active", True):
                continue
            monthly, _ = plan_item_month_values(item, month)
            amount = _money(monthly)
            direction = item.get("direction")
            if direction in planned_by_direction:
                planned_by_direction[direction] += abs(amount)
            if amount == 0:
                continue
            area = _overview_dimension_label(item.get("area"), item.get("area_id"), area_labels)
            category = _overview_dimension_label(
                item.get("category"), item.get("category_id"), category_labels
            )
            area_groups.setdefault(area, {"plan": Decimal("0.00"), "actual": Decimal("0.00")})["plan"] += amount
            category_groups.setdefault(category, {"plan": Decimal("0.00"), "actual": Decimal("0.00")})["plan"] += amount

    month_start, month_end = _month_window(month)
    bookings = data.get("bookings", [])
    if isinstance(bookings, list):
        for booking in bookings:
            if not isinstance(booking, dict):
                continue
            booking_date = _overview_booking_date(booking)
            if booking_date is None or not month_start <= booking_date <= month_end:
                continue
            amount = _overview_booking_amount(booking)
            if amount > 0:
                actual_by_direction["income"] += amount
            elif amount < 0:
                actual_by_direction["expense"] += amount
            booking_direction = booking.get("direction")
            if booking_direction == "saving":
                actual_by_direction["saving"] += amount

            allocations = booking.get("allocations")
            clean_allocations = [
                allocation for allocation in allocations
                if isinstance(allocation, dict)
            ] if isinstance(allocations, list) else []
            allocated = Decimal("0.00")
            for allocation in clean_allocations:
                try:
                    share = abs(_money(allocation.get("amount", 0)))
                except (InvalidOperation, ValueError, TypeError):
                    continue
                if share == 0:
                    continue
                allocated += share
                signed_share = share if amount >= 0 else -share
                area = _overview_dimension_label(
                    allocation.get("area"), allocation.get("area_id"), area_labels
                )
                category = _overview_dimension_label(
                    allocation.get("category"),
                    allocation.get("category_id"),
                    category_labels,
                )
                area_groups.setdefault(area, {"plan": Decimal("0.00"), "actual": Decimal("0.00")})["actual"] += signed_share
                category_groups.setdefault(category, {"plan": Decimal("0.00"), "actual": Decimal("0.00")})["actual"] += signed_share

            remainder = abs(amount) - allocated
            if not clean_allocations or remainder > 0:
                remainder = max(Decimal("0.00"), remainder)
                signed_remainder = remainder if amount >= 0 else -remainder
                area_groups.setdefault("Nicht zugeordnet", {"plan": Decimal("0.00"), "actual": Decimal("0.00")})["actual"] += signed_remainder
                category_groups.setdefault("Nicht zugeordnet", {"plan": Decimal("0.00"), "actual": Decimal("0.00")})["actual"] += signed_remainder

    return area_groups, category_groups, planned_by_direction, actual_by_direction


def overview_details(
    data: dict[str, object],
    month: str,
    *,
    today: date | None = None,
) -> dict[str, object]:
    """Calculate the detailed live dashboard contract for one month."""

    month_start, month_end = _month_window(month)
    area_groups, category_groups, planned, actual = _overview_breakdown_groups(data, month)
    plan_total = sum(
        (value for values in area_groups.values() for value in [values["plan"]]),
        Decimal("0.00"),
    )
    actual_total = sum(
        (value for values in area_groups.values() for value in [values["actual"]]),
        Decimal("0.00"),
    )

    day_count = (month_end - month_start).days + 1
    days = [month_start + timedelta(days=index) for index in range(day_count)]
    actual_by_day = {current: Decimal("0.00") for current in days}
    scheduled_by_day = {current: Decimal("0.00") for current in days}
    plan_items = data.get("plan_items", [])
    if isinstance(plan_items, list):
        for item in plan_items:
            if not isinstance(item, dict) or not item.get("active", True):
                continue
            _, scheduled = plan_item_month_values(item, month)
            if scheduled:
                event_date = _overview_plan_payment_date(item, month_start, month_end)
                scheduled_by_day[event_date] += _money(scheduled)

    feed_profiles = data.get("feed_profiles", [])
    if isinstance(feed_profiles, list):
        for profile in feed_profiles:
            if not isinstance(profile, dict):
                continue
            forecast = feed_profile_forecast(profile, today=today)
            purchase_date = _stored_plan_date(forecast.get("next_purchase_date"))
            if purchase_date and month_start <= purchase_date <= month_end:
                scheduled_by_day[purchase_date] += -_money(profile.get("expected_cost", 0))

    bookings = data.get("bookings", [])
    if isinstance(bookings, list):
        for booking in bookings:
            if not isinstance(booking, dict):
                continue
            booking_date = _overview_booking_date(booking)
            if booking_date in actual_by_day:
                actual_by_day[booking_date] += _overview_booking_amount(booking)

    planned_running = Decimal("0.00")
    forecast_running = Decimal("0.00")
    actual_running = Decimal("0.00")
    planned_values: list[float] = []
    forecast_values: list[float] = []
    actual_values: list[float] = []
    for current in days:
        planned_running += plan_total / Decimal(day_count)
        actual_running += actual_by_day[current]
        forecast_running += actual_by_day[current] + scheduled_by_day[current]
        planned_values.append(float(_money(planned_running)))
        forecast_values.append(float(_money(forecast_running)))
        actual_values.append(float(_money(actual_running)))

    reference_date = today or date.today()
    today_index = 0 if reference_date < month_start else day_count - 1
    if month_start <= reference_date <= month_end:
        today_index = reference_date.day - 1
    all_values = planned_values + forecast_values + actual_values + [0.0]
    return {
        "household": {
            "income": float(_money(actual["income"])),
            "expenses": float(_money(actual["expense"])),
            "savings": float(_money(actual["saving"])),
            "available": float(_money(actual_total)),
            "income_plan": float(_money(planned["income"])),
            "expenses_plan": float(_money(-planned["expense"])),
            "savings_plan": float(_money(-planned["saving"])),
            "available_plan": float(_money(plan_total)),
        },
        "areas": _overview_breakdown(area_groups, limit=6),
        "categories": _overview_breakdown(category_groups, limit=6),
        "comparison": overview_comparison(data, month, today=today),
        "trend": {
            "planned": planned_values,
            "forecast": forecast_values,
            "actual": actual_values,
            "min_value": min(all_values),
            "max_value": max(all_values),
            "today_index": today_index,
            "today_label": reference_date.strftime("%d. %b.") if month_start <= reference_date <= month_end else None,
        },
    }


def _parse_amount(value: str) -> float:
    normalized = value.strip().replace(" ", "")
    if "," in normalized:
        normalized = normalized.replace(".", "").replace(",", ".")
    try:
        return float(Decimal(normalized).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP))
    except InvalidOperation as exc:
        raise ValueError(f"Invalid amount: {value!r}") from exc


def _parse_date(value: str) -> date:
    return date(2000 + int(value[0:2]), int(value[2:4]), int(value[4:6]))


def parse_mt940_records(raw: str) -> list[ParsedBooking]:
    """Parse the common MT940 transaction subset into normalized bookings."""

    account = ""
    bookings: list[ParsedBooking] = []
    current: dict[str, object] | None = None
    current_lines: list[str] = []
    context_lines: list[str] = []

    def finish() -> None:
        nonlocal current, current_lines
        if current is not None:
            bookings.append(
                ParsedBooking(
                    booking=Booking(account=account, **current),
                    source_data={
                        "record": {"kind": "mt940_transaction", "lines": current_lines},
                        "context": {"lines": context_lines.copy()},
                    },
                )
            )
            current = None
            current_lines = []

    for raw_line in raw.splitlines():
        line = raw_line.strip()
        if line.startswith(":20:"):
            finish()
            account = ""
            context_lines = [raw_line]
        elif line.startswith(":25:"):
            finish()
            account = line[4:].strip()
            context_lines.append(raw_line)
        elif line.startswith(":61:"):
            finish()
            match = re.match(
                r":61:(?P<date>\d{6})(?:\d{4})?(?P<direction>[CD])(?P<amount>[\d.,]+)"
                r"(?:N[A-Z0-9]{3})?(?P<reference>[^/]*)",
                line,
            )
            if not match:
                raise ValueError(f"Unsupported MT940 :61: line: {line}")
            current = {
                "booking_date": _parse_date(match.group("date")),
                "amount": _parse_amount(match.group("amount"))
                * (1 if match.group("direction") == "C" else -1),
                "reference": match.group("reference").strip(),
                "purpose": "",
            }
            current_lines = [raw_line]
        elif current is not None:
            current_lines.append(raw_line)
            if line.startswith(":86:"):
                current["purpose"] = line[4:].strip()
        else:
            context_lines.append(raw_line)
    finish()
    return bookings


def parse_mt940(raw: str) -> list[Booking]:
    return [record.booking for record in parse_mt940_records(raw)]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _descendant_text(element: ET.Element, name: str) -> str:
    for child in element.iter():
        if _local_name(child.tag) == name and child.text:
            return child.text.strip()
    return ""


def _camt_related_party_name(entry: ET.Element, party_name: str) -> str:
    for related_parties in entry.iter():
        if _local_name(related_parties.tag) != "RltdPties":
            continue
        for party in related_parties:
            if _local_name(party.tag) == party_name:
                name = _descendant_text(party, "Nm")
                if name:
                    return name
    return ""


def _camt_counterparty(entry: ET.Element, direction: str) -> str:
    party_name = {"DBIT": "Cdtr", "CRDT": "Dbtr"}.get(direction.upper())
    if party_name:
        name = _camt_related_party_name(entry, party_name)
        if name:
            return name
    return _descendant_text(entry, "Nm")


def parse_camt053_records(raw: str) -> list[ParsedBooking]:
    """Parse CAMT.053 entries without binding the UI to a bank-specific namespace."""

    root = ET.fromstring(raw)
    bookings: list[ParsedBooking] = []
    for statement in root.iter():
        if _local_name(statement.tag) != "Stmt":
            continue
        account = ""
        account_node = next(
            (child for child in statement if _local_name(child.tag) == "Acct"),
            None,
        )
        if account_node is not None:
            account = _descendant_text(account_node, "IBAN")
        for entry in statement.iter():
            if _local_name(entry.tag) != "Ntry":
                continue
            amount_node = next(
                (node for node in entry if _local_name(node.tag) == "Amt"), None
            )
            direction = _descendant_text(entry, "CdtDbtInd")
            date_text = _descendant_text(entry, "Dt")
            if amount_node is None or not amount_node.text or not date_text:
                continue
            try:
                booking_date = date.fromisoformat(date_text[:10])
            except ValueError as exc:
                raise ValueError(f"Unsupported CAMT.053 booking date: {date_text!r}") from exc
            amount = _parse_amount(amount_node.text)
            if direction.upper() != "CRDT":
                amount = -amount
            bookings.append(
                ParsedBooking(
                    booking=Booking(
                        account=account,
                        booking_date=booking_date,
                        amount=amount,
                        purpose=_descendant_text(entry, "Ustrd"),
                        reference=_descendant_text(entry, "EndToEndId"),
                        counterparty=_camt_counterparty(entry, direction),
                        currency=amount_node.attrib.get("Ccy", "EUR"),
                        sender=_camt_related_party_name(entry, "Dbtr"),
                    ),
                    source_data={
                        "record": source_xml_node(entry),
                        "context": {
                            "statement": source_xml_node(
                                statement, exclude_names=frozenset({"Ntry"})
                            ),
                            "account": account,
                        },
                    },
                )
            )
    return bookings


def parse_camt053(raw: str) -> list[Booking]:
    return [record.booking for record in parse_camt053_records(raw)]


def _source_node_text(node: object, name: str) -> str:
    if not isinstance(node, dict):
        return ""
    if node.get("name") == name:
        text = node.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()
        if name in {"Dbtr", "Cdtr"}:
            children = node.get("children")
            if isinstance(children, list):
                return _source_node_text_from_children(children, "Nm")
    children = node.get("children")
    if isinstance(children, list):
        for child in children:
            text = _source_node_text(child, name)
            if text:
                return text
    return ""


def _source_node_text_from_children(children: list[object], name: str) -> str:
    for child in children:
        text = _source_node_text(child, name)
        if text:
            return text
    return ""


def sender_from_camt_source(source_data: object) -> str | None:
    """Extract a stored CAMT debtor name for non-destructive backfills."""

    if not isinstance(source_data, dict) or source_data.get("format") != "CAMT.053":
        return None
    record = source_data.get("record")
    if not isinstance(record, dict):
        return None
    children = record.get("children")
    if not isinstance(children, list):
        return None
    for child in children:
        if not isinstance(child, dict) or child.get("name") != "NtryDtls":
            continue
        sender = _source_node_text(child, "Dbtr")
        if sender:
            return sender
    return None


def camt_account_references_from_source(source_data: object) -> dict[str, str]:
    """Extract related debtor and creditor account references from CAMT data."""

    if not isinstance(source_data, dict) or source_data.get("format") != "CAMT.053":
        return {}
    record = source_data.get("record")
    if not isinstance(record, dict):
        return {}

    references: dict[str, str] = {}

    def visit(node: object, account_names: dict[str, str]) -> None:
        if not isinstance(node, dict):
            return
        name = node.get("name")
        if name in account_names:
            reference = _source_node_text(node, "IBAN") or _source_node_text(node, "Id")
            key = account_names[name]
            if reference and key not in references:
                references[key] = reference
        children = node.get("children")
        if isinstance(children, list):
            for child in children:
                visit(child, account_names)

    visit(record, {"DbtrAcct": "Dbtr", "CdtrAcct": "Cdtr"})
    # Some bank exports put the related account reference in an agent node
    # instead of providing the standard DbtrAcct/CdtrAcct nodes.
    visit(record, {"DbtrAgt": "Dbtr", "CdtrAgt": "Cdtr"})
    return references


def booking_fingerprint(booking: Booking) -> str:
    """Generate a stable deduplication key from normalized booking fields."""

    material = "|".join(
        (
            normalize_account_reference(booking.account),
            booking.booking_date.isoformat(),
            f"{_money(booking.amount):.2f}",
            booking.reference.strip().upper(),
            booking.counterparty.strip().casefold(),
            booking.purpose.strip().casefold(),
        )
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()
