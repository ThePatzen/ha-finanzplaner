import asyncio
import importlib
import sys
import types
import unittest
from unittest.mock import patch

from custom_components.finanzplaner.const import DOMAIN
from custom_components.finanzplaner.core import (
    plan_item_totals,
    validate_plan_item_payload,
)
from custom_components.finanzplaner.storage import migrate_store_data


class PlanItemDomainTests(unittest.TestCase):
    def test_store_adds_editor_defaults_without_replacing_source_metadata(self):
        migrated = migrate_store_data(
            {
                "version": 2,
                "plan_items": [
                    {
                        "name": "Importierte Ausgabe",
                        "amount": 25.0,
                        "source_sheet": "Ausgaben",
                        "source_row": 8,
                    }
                ],
            },
            "Testhaushalt",
        )

        item = migrated["plan_items"][0]
        self.assertTrue(item["id"].startswith("plan-item-"))
        self.assertTrue(item["active"])
        self.assertEqual(item["remaining_amount"], 25.0)
        self.assertEqual(item["source_sheet"], "Ausgaben")
        self.assertEqual(item["source_row"], 8)

    def test_validates_and_normalizes_a_recurring_plan_item(self):
        result = validate_plan_item_payload(
            {
                "name": "  Miete  ",
                "direction": "expense",
                "category": " Wohnen ",
                "area": "Haushalt",
                "project": "",
                "amount": "1.250,00",
                "frequency_months": 1,
                "due_day": 3,
                "due_date": None,
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
                "target": "household",
                "active": True,
            },
            {"person.alex", "household"},
        )

        self.assertEqual(result["name"], "Miete")
        self.assertEqual(result["amount"], 1250.0)
        self.assertEqual(result["category"], "Wohnen")
        self.assertIsNone(result["project"])
        self.assertEqual(plan_item_totals(result["amount"], result["frequency_months"]), (1250.0, 15000.0))

    def test_supports_one_time_plan_items_and_rejects_invalid_schedule(self):
        result = validate_plan_item_payload(
            {
                "name": "Urlaubsgeld",
                "direction": "income",
                "amount": 900,
                "frequency_months": None,
                "due_date": "2026-06-30",
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
            },
            {"household"},
        )

        self.assertIsNone(result["frequency_months"])
        self.assertEqual(plan_item_totals(900, None), (None, 900.0))

        invalid = {
            "name": "Ungültig",
            "direction": "expense",
            "amount": 10.001,
            "frequency_months": 1,
        }
        with self.assertRaises(ValueError):
            validate_plan_item_payload(invalid, {"household"})
        with self.assertRaisesRegex(ValueError, "Ende darf nicht vor dem Beginn"):
            validate_plan_item_payload(
                {
                    "name": "Zeitraum",
                    "direction": "expense",
                    "amount": 10,
                    "frequency_months": 1,
                    "start_date": "2026-12-01",
                    "end_date": "2026-01-01",
                },
                {"household"},
            )


def _load_http_module():
    class HTTPBadRequest(Exception):
        def __init__(self, *, text):
            super().__init__(text)
            self.text = text

    class HTTPNotFound(Exception):
        def __init__(self, *, text):
            super().__init__(text)
            self.text = text

    fake_web = types.ModuleType("aiohttp.web")
    fake_web.HTTPBadRequest = HTTPBadRequest
    fake_web.HTTPNotFound = HTTPNotFound
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
    fake_components = types.ModuleType("homeassistant.components")
    fake_homeassistant = types.ModuleType("homeassistant")

    class FakeCoordinator:
        pass

    fake_coordinator = types.ModuleType("custom_components.finanzplaner.coordinator")
    fake_coordinator.FinanzplanerCoordinator = FakeCoordinator

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
        module = importlib.import_module("custom_components.finanzplaner.http")
    return module, FakeCoordinator, HTTPBadRequest, HTTPNotFound


class PlanItemApiTests(unittest.TestCase):
    def setUp(self):
        self.http, coordinator_type, self.bad_request, self.not_found = _load_http_module()

        class FakeStore:
            def __init__(self):
                self.data = {
                    "plan_items": [
                        {
                            "id": "plan-item-1",
                            "name": "Alte Rücklage",
                            "direction": "saving",
                            "category": "Rücklagen",
                            "area": None,
                            "project": None,
                            "amount": 100.0,
                            "remaining_amount": 100.0,
                            "frequency_months": 1,
                            "target": "household",
                            "active": True,
                            "source_sheet": "Einnahmen",
                            "source_row": 4,
                        }
                    ]
                }
                self.save_count = 0

            async def async_save(self):
                self.save_count += 1

        self.coordinator = coordinator_type()
        self.coordinator.store = FakeStore()
        self.coordinator.data = self.coordinator.store.data
        self.coordinator.refresh_count = 0

        async def async_refresh_data():
            self.coordinator.refresh_count += 1

        self.coordinator.async_refresh_data = async_refresh_data
        states = [
            types.SimpleNamespace(domain="person", entity_id="person.alex"),
            types.SimpleNamespace(domain="light", entity_id="light.kitchen"),
        ]
        hass = types.SimpleNamespace(
            data={DOMAIN: {"entry": self.coordinator}},
            states=types.SimpleNamespace(async_all=lambda: states),
        )
        self.app = {"hass": hass}

    def _request(self, payload=None):
        app = self.app

        class Request:
            async def json(self):
                return payload

        request = Request()
        request.app = app
        return request

    def test_views_are_authenticated_and_use_stable_routes(self):
        self.assertTrue(self.http.PlanItemsView.requires_auth)
        self.assertTrue(self.http.PlanItemView.requires_auth)
        self.assertEqual(self.http.PlanItemsView.url, "/api/finanzplaner/plan-items")
        self.assertEqual(self.http.PlanItemView.url, "/api/finanzplaner/plan-items/{plan_item_id}")

    def test_create_returns_computed_totals_and_persists(self):
        result = asyncio.run(
            self.http.PlanItemsView().post(
                self._request(
                    {
                        "name": "PV-Erlöse",
                        "direction": "income",
                        "category": "Energieerlöse",
                        "project": "PV-Anlage",
                        "amount": "125,50",
                        "frequency_months": 3,
                        "due_day": 15,
                        "target": "household",
                        "active": True,
                    }
                )
            )
        )

        item = self.coordinator.store.data["plan_items"][-1]
        self.assertEqual(item["amount"], 125.5)
        self.assertEqual(item["normalized_monthly"], 41.83)
        self.assertEqual(item["annual_amount"], 502.0)
        self.assertEqual(result["plan_item"]["name"], "PV-Erlöse")
        self.assertEqual(self.coordinator.store.save_count, 1)
        self.assertEqual(self.coordinator.refresh_count, 1)

    def test_update_preserves_import_source_and_archive_is_reversible(self):
        result = asyncio.run(
            self.http.PlanItemView().post(
                self._request(
                    {
                        "name": "Rücklage angepasst",
                        "direction": "saving",
                        "amount": 110,
                        "frequency_months": 1,
                        "active": True,
                    }
                ),
                "plan-item-1",
            )
        )

        item = self.coordinator.store.data["plan_items"][0]
        self.assertEqual(item["name"], "Rücklage angepasst")
        self.assertEqual(item["source_sheet"], "Einnahmen")
        self.assertEqual(item["source_row"], 4)
        self.assertEqual(result["plan_item"]["amount"], 110.0)

        archived = asyncio.run(self.http.PlanItemView().delete(self._request(), "plan-item-1"))
        self.assertFalse(item["active"])
        self.assertTrue(archived["archived"])
        self.assertEqual(self.coordinator.store.save_count, 2)

    def test_invalid_update_does_not_mutate_or_save(self):
        before = dict(self.coordinator.store.data["plan_items"][0])
        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.PlanItemView().post(
                    self._request(
                        {
                            "name": "Rücklage",
                            "direction": "saving",
                            "amount": 10.001,
                            "frequency_months": 1,
                        }
                    ),
                    "plan-item-1",
                )
            )
        self.assertEqual(self.coordinator.store.data["plan_items"][0], before)
        self.assertEqual(self.coordinator.store.save_count, 0)

    def test_list_returns_plan_items_without_mutating_store(self):
        result = asyncio.run(self.http.PlanItemsView().get(self._request()))
        self.assertEqual(result["plan_items"][0]["id"], "plan-item-1")
        self.assertEqual(self.coordinator.store.data["plan_items"][0]["amount"], 100.0)


class PlanItemRegistrationTests(unittest.TestCase):
    def test_async_setup_registers_authenticated_plan_item_views(self):
        http, _, _, _ = _load_http_module()
        registered = []
        hass = types.SimpleNamespace(
            data={},
            http=types.SimpleNamespace(register_view=registered.append),
        )

        from custom_components import finanzplaner

        with patch.dict(sys.modules, {"custom_components.finanzplaner.http": http}):
            asyncio.run(finanzplaner.async_setup(hass, {}))

        self.assertIn(http.PlanItemsView, registered)
        self.assertIn(http.PlanItemView, registered)
        self.assertTrue(http.PlanItemsView.requires_auth)
        self.assertTrue(http.PlanItemView.requires_auth)


if __name__ == "__main__":
    unittest.main()
