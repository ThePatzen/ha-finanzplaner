"""Small dependency-free domain core used by the integration and its tests."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import re
import xml.etree.ElementTree as ET


MONEY_QUANT = Decimal("0.01")


@dataclass(frozen=True, slots=True)
class Allocation:
    """A booking share assigned to a person or shared household target."""

    target: str
    amount: float
    area: str | None = None
    category: str | None = None
    project: str | None = None


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
    plan = sum(float(item.get("amount", 0)) for item in plan_items)
    actual = sum(
        float(item.get("amount", 0))
        for item in bookings
        if str(item.get("booking_date", "")).startswith(month)
    )
    planned_remaining = sum(float(item.get("remaining_amount", 0)) for item in plan_items)
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
    account = _descendant_text(root, "IBAN")
    bookings: list[Booking] = []
    for entry in root.iter():
        if _local_name(entry.tag) != "Ntry":
            continue
        amount_node = next(
            (node for node in entry.iter() if _local_name(node.tag) == "Amt"), None
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
            booking.account.strip().upper(),
            booking.booking_date.isoformat(),
            f"{_money(booking.amount):.2f}",
            booking.reference.strip().upper(),
            booking.counterparty.strip().casefold(),
            booking.purpose.strip().casefold(),
        )
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()
