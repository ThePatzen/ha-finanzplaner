import asyncio
import importlib
import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import patch


def _load_http_module():
    class HTTPError(Exception):
        status_code = 400

        def __init__(self, *, text=""):
            super().__init__(text)
            self.text = text

    fake_web = types.ModuleType("aiohttp.web")
    for name in ("HTTPBadRequest", "HTTPNotFound", "HTTPUnauthorized"):
        setattr(fake_web, name, HTTPError)
    fake_web.Request = object
    fake_web.Response = object
    fake_web.FileField = object
    fake_aiohttp = types.ModuleType("aiohttp")
    fake_aiohttp.web = fake_web

    class HomeAssistantView:
        def json(self, payload):
            return payload

    fake_http = types.ModuleType("homeassistant.components.http")
    fake_http.HomeAssistantView = HomeAssistantView
    fake_homeassistant = types.ModuleType("homeassistant")
    fake_components = types.ModuleType("homeassistant.components")
    fake_coordinator = types.ModuleType("custom_components.finanzplaner.coordinator")
    fake_coordinator.FinanzplanerCoordinator = type("FinanzplanerCoordinator", (), {})
    modules = {
        "aiohttp": fake_aiohttp,
        "aiohttp.web": fake_web,
        "homeassistant": fake_homeassistant,
        "homeassistant.components": fake_components,
        "homeassistant.components.http": fake_http,
        "custom_components.finanzplaner.coordinator": fake_coordinator,
    }
    with patch.dict(sys.modules, modules):
        sys.modules.pop("custom_components.finanzplaner.http", None)
        return importlib.import_module("custom_components.finanzplaner.http")


class Request:
    def __init__(self, hass, query=None, payload=None, json_error=None):
        self.app = {"hass": hass}
        self.query = query or {}
        self._payload = payload
        self._json_error = json_error

    async def json(self):
        if self._json_error:
            raise self._json_error("invalid json")
        return self._payload


class Store:
    def __init__(self, data):
        self.data = data
        self.saves = 0

    async def async_save(self):
        self.saves += 1


class Coordinator:
    def __init__(self, data):
        self.store = Store(data)
        self.data = data
        self.refreshes = 0

    async def async_refresh_data(self):
        self.refreshes += 1

    async def async_refresh(self):
        self.refreshes += 1


class State:
    def __init__(self, entity_id):
        self.entity_id = entity_id
        self.domain = entity_id.split(".", 1)[0]


class States:
    def async_all(self):
        return [State("person.old"), State("person.new")]


class Hass:
    def __init__(self, coordinator):
        self.data = {"finanzplaner": {"entry": coordinator}}
        self.states = States()


class BookingHistoryReportsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = _load_http_module()

    def setUp(self):
        self.coordinator = Coordinator({
            "bookings": [
                {
                    "id": "booking-1", "booking_date": "2026-01-10", "amount": -12.34,
                    "purpose": "Rent January", "status": "resolved", "account_id": "account-1",
                    "allocations": [{"target": "person.old", "amount": 12.34, "category_id": "cat-rent"}],
                    "source_data": {"content_base64": "secret"},
                },
                {"id": "booking-2", "booking_date": "2026-02-10", "amount": -20,
                 "purpose": "Rent February", "status": "resolved", "account_id": "account-1", "allocations": []},
                {"id": "booking-3", "booking_date": "2026-02-10", "amount": -5,
                 "purpose": "Food", "status": "unresolved", "account_id": "account-2", "allocations": []},
            ],
            "imports": [{"filename": "rent.mt940", "accepted": 2, "content_base64": "secret"}],
            "persons": [], "accounts": [
                {"id": "account-1", "label": "Gemeinsames Girokonto"},
                {"id": "account-2", "label": "Rücklagen"},
            ], "catalogs": {"categories": [], "areas": [], "projects": []},
        })
        self.http.FinanzplanerCoordinator = Coordinator
        self.hass = Hass(self.coordinator)

    def test_booking_history_filters_and_paginates_without_exposing_source_bytes(self):
        response = asyncio.run(self.http.BookingHistoryView().get(
            Request(self.hass, {"q": "rent", "status": "resolved", "limit": "1"})
        ))
        self.assertEqual(response["total"], 2)
        self.assertEqual(len(response["bookings"]), 1)
        self.assertNotIn("source_data", response["bookings"][0])

    def test_booking_history_q_searches_configured_account_labels(self):
        response = asyncio.run(self.http.BookingHistoryView().get(
            Request(self.hass, {"q": "rücklagen"})
        ))
        self.assertEqual(response["total"], 1)
        self.assertEqual(response["bookings"][0]["id"], "booking-3")

    def test_booking_history_projects_live_target_status_and_label(self):
        response = asyncio.run(self.http.BookingHistoryView().get(Request(self.hass)))

        allocation = response["bookings"][0]["allocations"][0]
        self.assertEqual(allocation["target_status"], "available")
        self.assertEqual(allocation["target_label"], "person.old")

    def test_repair_targets_replaces_only_person_reference_and_preserves_amount(self):
        response = asyncio.run(self.http.BookingTargetRepairView().post(
            Request(self.hass, payload={"repairs": [{"from": "person.old", "to": "person.new"}]}),
            "booking-1",
        ))
        self.assertEqual(response["booking"]["allocations"][0]["amount"], 12.34)
        self.assertEqual(response["booking"]["allocations"][0]["target"], "person.new")
        self.assertEqual(response["booking"]["allocations"][0]["target_status"], "available")
        self.assertEqual(response["booking"]["allocations"][0]["target_label"], "person.new")
        self.assertEqual(self.coordinator.store.saves, 1)
        self.assertEqual(self.coordinator.refreshes, 1)

    def test_report_and_import_history_are_projected(self):
        report = asyncio.run(self.http.ReportView().get(
            Request(self.hass, {"from": "2026-01-01", "to": "2026-02-28", "view": "month"})
        ))
        self.assertIn("cashflow", report["report"])
        imports = asyncio.run(self.http.ImportHistoryView().get(Request(self.hass)))
        self.assertNotIn("content_base64", str(imports))

    def test_report_year_keeps_all_requested_months(self):
        response = asyncio.run(self.http.ReportView().get(
            Request(self.hass, {"from": "2026-01-01", "to": "2026-03-31", "view": "year"})
        ))
        self.assertEqual([item["month"] for item in response["report"]["cashflow"]], ["2026-01", "2026-02", "2026-03"])

    def test_report_cashflow_returns_chronological_series(self):
        response = asyncio.run(self.http.ReportView().get(
            Request(self.hass, {"from": "2026-01-01", "to": "2026-03-31", "view": "cashflow"})
        ))
        self.assertEqual(list(response["report"]), ["cashflow"])
        self.assertEqual([item["month"] for item in response["report"]["cashflow"]], ["2026-01", "2026-02", "2026-03"])

    def test_repair_targets_rejects_invalid_json_without_mutation(self):
        with self.assertRaises(Exception) as context:
            asyncio.run(self.http.BookingTargetRepairView().post(
                Request(self.hass, json_error=ValueError), "booking-1"
            ))
        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(self.coordinator.store.saves, 0)
        self.assertEqual(self.coordinator.refreshes, 0)

    def test_repair_targets_rejects_invalid_second_target_without_mutation(self):
        with self.assertRaises(Exception):
            asyncio.run(self.http.BookingTargetRepairView().post(
                Request(self.hass, payload={"repairs": [
                    {"from": "person.old", "to": "person.new"},
                    {"from": "person.new", "to": "person.missing"},
                ]}), "booking-1"
            ))
        self.assertEqual(self.coordinator.store.data["bookings"][0]["allocations"][0]["target"], "person.old")
        self.assertEqual(self.coordinator.store.saves, 0)
        self.assertEqual(self.coordinator.refreshes, 0)

    def test_repair_targets_rejects_empty_repairs_without_side_effects(self):
        with self.assertRaises(Exception):
            asyncio.run(self.http.BookingTargetRepairView().post(
                Request(self.hass, payload={"repairs": []}), "booking-1"
            ))
        self.assertEqual(self.coordinator.store.saves, 0)
        self.assertEqual(self.coordinator.refreshes, 0)


if __name__ == "__main__":
    unittest.main()
