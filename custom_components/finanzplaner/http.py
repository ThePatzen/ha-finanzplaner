"""Authenticated local HTTP views for the native Finanzplaner panel."""

from __future__ import annotations

from datetime import date
import hashlib
from typing import Any
from uuid import uuid4

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .const import DOMAIN
from .core import (
    Booking,
    booking_fingerprint,
    ensure_account,
    normalize_account_reference,
    overview_values,
    parse_camt053,
    parse_mt940,
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


def _redact_account_value(value: object) -> object:
    """Keep account context in import previews without exposing a full IBAN."""

    if not isinstance(value, str):
        return value
    normalized = normalize_account_reference(value)
    if (
        len(normalized) >= 15
        and normalized[:2].isalpha()
        and normalized[2:4].isdigit()
    ):
        return f"…{normalized[-4:]}"
    return value


def _response_payload(value: object) -> object:
    """Copy JSON data while redacting IBANs at every response boundary."""

    if isinstance(value, dict):
        return {
            key: (
                _redact_account_value(item)
                if key in {"account", "account_reference"}
                else _response_payload(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_response_payload(item) for item in value]
    return value


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
    if not data.get("plan_items") and not data.get("bookings"):
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

    url = "/api/finanzplaner/bookings/<booking_id>"
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
        targets = [target.strip() for target in targets if target.strip()]
        valid_targets = {
            "household",
            *(
                state.entity_id
                for state in request.app["hass"].states.async_all()
                if state.domain == "person"
            ),
        }
        if (
            not targets
            or len(set(targets)) != len(targets)
            or any(target not in valid_targets for target in targets)
        ):
            raise web.HTTPBadRequest(text="Eine Zuordnung verweist nicht auf eine bekannte Person.")

        area = payload.get("area") or None
        if area not in (None, "Hunde"):
            raise web.HTTPBadRequest(text="Dieser Bereich ist noch nicht verfügbar.")

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

        allocations = split_amount(float(booking.get("amount", 0)), targets)
        booking["allocations"] = [
            {
                "target": allocation.target,
                "amount": allocation.amount,
                "area": area,
                "category": None,
                "project": None,
            }
            for allocation in allocations
        ]
        booking["status"] = "resolved"
        await coordinator.store.async_save()
        await coordinator.async_refresh_data()
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

        existing = {booking.get("id") for booking in coordinator.store.data.get("bookings", [])}
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
