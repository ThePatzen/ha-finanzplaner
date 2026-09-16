"""Small dependency-free domain core used by the integration and its tests."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import re
import xml.etree.ElementTree as ET


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


def parse_mt940(raw: str) -> list[Booking]:
    """Parse the common MT940 transaction subset into normalized bookings."""

    account = ""
    bookings: list[Booking] = []
    current: dict[str, object] | None = None
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith(":25:"):
            if current is not None:
                bookings.append(Booking(account=account, **current))
                current = None
            account = line[4:].strip()
        elif line.startswith(":61:"):
            if current is not None:
                bookings.append(Booking(account=account, **current))
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
        elif line.startswith(":86:") and current is not None:
            current["purpose"] = line[4:].strip()
    if current is not None:
        bookings.append(Booking(account=account, **current))
    return bookings


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _descendant_text(element: ET.Element, name: str) -> str:
    for child in element.iter():
        if _local_name(child.tag) == name and child.text:
            return child.text.strip()
    return ""


def parse_camt053(raw: str) -> list[Booking]:
    """Parse CAMT.053 entries without binding the UI to a bank-specific namespace."""

    root = ET.fromstring(raw)
    bookings: list[Booking] = []
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
                Booking(
                    account=account,
                    booking_date=booking_date,
                    amount=amount,
                    purpose=_descendant_text(entry, "Ustrd"),
                    reference=_descendant_text(entry, "EndToEndId"),
                    counterparty=_descendant_text(entry, "Nm"),
                    currency=amount_node.attrib.get("Ccy", "EUR"),
                )
            )
    return bookings


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
