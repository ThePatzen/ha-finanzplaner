import asyncio
import importlib
import json
import sys
import types
import unittest
from unittest.mock import patch

from custom_components import finanzplaner
from custom_components.finanzplaner.const import DOMAIN


def _load_core():
    return importlib.import_module("custom_components.finanzplaner.core")


def _load_http_module():
    class HTTPBadRequest(Exception):
        status_code = 400

        def __init__(self, *, text):
            super().__init__(text)
            self.text = text

    class HTTPUnauthorized(Exception):
        status_code = 401

    fake_web = types.ModuleType("aiohttp.web")
    fake_web.HTTPBadRequest = HTTPBadRequest
    fake_web.HTTPUnauthorized = HTTPUnauthorized
    fake_web.HTTPNotFound = HTTPBadRequest
    fake_web.Request = object
    fake_web.Response = object
    fake_web.FileField = object
    fake_aiohttp = types.ModuleType("aiohttp")
    fake_aiohttp.web = fake_web

    class HomeAssistantView:
        def __init_subclass__(cls):
            super().__init_subclass__()
            if not getattr(cls, "requires_auth", False):
                return
            for method_name in ("get", "post", "delete"):
                handler = cls.__dict__.get(method_name)
                if handler is None:
                    continue

                async def authenticated_handler(
                    self, request, *args, _handler=handler, **kwargs
                ):
                    if not getattr(request, "authenticated", False):
                        raise HTTPUnauthorized()
                    return await _handler(self, request, *args, **kwargs)

                setattr(cls, method_name, authenticated_handler)

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
    return module, FakeCoordinator, HTTPBadRequest, HTTPUnauthorized


class OverviewBreakdownDomainTests(unittest.TestCase):
    def test_returns_matching_monthly_plan_item_and_signed_booking_amount(self):
        core = _load_core()

        breakdown = core.overview_breakdown(
            {
                "catalogs": {
                    "categories": [{"id": "category-food", "label": "Futter"}],
                },
                "plan_items": [
                    {
                        "id": "plan-food",
                        "name": "Futterbudget",
                        "active": True,
                        "direction": "expense",
                        "amount": 100,
                        "frequency_months": 1,
                        "due_day": 5,
                        "category_id": "category-food",
                    },
                    {
                        "id": "plan-october",
                        "active": True,
                        "direction": "expense",
                        "amount": 80,
                        "frequency_months": None,
                        "due_date": "2026-10-05",
                        "category_id": "category-food",
                    },
                    {
                        "id": "plan-inactive",
                        "active": False,
                        "direction": "expense",
                        "amount": 60,
                        "frequency_months": 1,
                        "category_id": "category-food",
                    },
                ],
                "bookings": [
                    {
                        "id": "booking-food",
                        "booking_date": "2026-09-03",
                        "amount": -30,
                        "allocations": [
                            {"amount": 30, "category_id": "category-food"}
                        ],
                    },
                    {
                        "id": "booking-october",
                        "booking_date": "2026-10-03",
                        "amount": -40,
                        "allocations": [
                            {"amount": 40, "category_id": "category-food"}
                        ],
                    },
                ],
            },
            "2026-09",
            "categories",
            "category-food",
        )

        self.assertEqual(breakdown["name"], "Futter")
        self.assertEqual([item["id"] for item in breakdown["plan_items"]], ["plan-food"])
        self.assertEqual([item["id"] for item in breakdown["bookings"]], ["booking-food"])
        self.assertEqual(breakdown["bookings"][0]["matched_amount"], -30.0)

    def test_returns_unassigned_booking_remainder(self):
        core = _load_core()

        breakdown = core.overview_breakdown(
            {
                "bookings": [
                    {
                        "id": "booking-partial",
                        "booking_date": "2026-09-03",
                        "amount": -50,
                        "allocations": [{"amount": 30, "category_id": "category-food"}],
                    }
                ]
            },
            "2026-09",
            "categories",
            "__unassigned__",
        )

        self.assertEqual(breakdown["name"], "Nicht zugeordnet")
        self.assertEqual(breakdown["plan_items"], [])
        self.assertEqual(breakdown["bookings"][0]["matched_amount"], -20.0)


class OverviewBreakdownViewTests(unittest.TestCase):
    def setUp(self):
        (
            self.http,
            coordinator_type,
            self.bad_request,
            self.unauthorized,
        ) = _load_http_module()

        class FakeStore:
            def __init__(self):
                self.data = {
                    "catalogs": {
                        "categories": [
                            {"id": "category-food", "label": "Futter"}
                        ]
                    },
                    "plan_items": [
                        {
                            "id": "plan-food",
                            "name": "Futterbudget",
                            "active": True,
                            "direction": "expense",
                            "amount": 100,
                            "frequency_months": 1,
                            "due_day": 5,
                            "category_id": "category-food",
                        }
                    ],
                    "bookings": [
                        {
                            "id": "booking-food",
                            "booking_date": "2026-09-03",
                            "amount": -30,
                            "account": "AT123456789012345678",
                            "account_reference": "AT123456789012345678",
                            "allocations": [
                                {"amount": 30, "category_id": "category-food"}
                            ],
                        }
                    ],
                }

        self.coordinator = coordinator_type()
        self.coordinator.store = FakeStore()
        self.coordinator.data = self.coordinator.store.data
        hass = types.SimpleNamespace(data={DOMAIN: {"entry": self.coordinator}})
        self.app = {"hass": hass}

    def _request(self, query, *, authenticated=True):
        request = types.SimpleNamespace()
        request.app = self.app
        request.query = query
        request.authenticated = authenticated
        return request

    def test_get_requires_authentication(self):
        with self.assertRaises(self.unauthorized) as raised:
            asyncio.run(
                self.http.OverviewBreakdownView().get(
                    self._request({}, authenticated=False)
                )
            )

        self.assertEqual(raised.exception.status_code, 401)

    def test_get_rejects_unknown_dimension(self):
        with self.assertRaises(self.bad_request) as raised:
            asyncio.run(
                self.http.OverviewBreakdownView().get(
                    self._request(
                        {
                            "month": "2026-09",
                            "dimension": "targets",
                            "key": "category-food",
                        }
                    )
                )
            )

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("Dimension", raised.exception.text)

    def test_get_returns_masked_details_without_mutating_store(self):
        before = json.dumps(self.coordinator.store.data, sort_keys=True, separators=(",", ":"))

        result = asyncio.run(
            self.http.OverviewBreakdownView().get(
                self._request(
                    {
                        "month": "2026-09",
                        "dimension": "categories",
                        "key": "category-food",
                    }
                )
            )
        )

        self.assertEqual(result["month"], "2026-09")
        self.assertEqual(result["dimension"], "categories")
        self.assertEqual(result["key"], "category-food")
        self.assertEqual(result["plan_items"][0]["id"], "plan-food")
        self.assertEqual(result["bookings"][0]["matched_amount"], -30.0)
        self.assertIn("…5678", str(result))
        self.assertNotIn("AT123456789012345678", str(result))
        after = json.dumps(self.coordinator.store.data, sort_keys=True, separators=(",", ":"))
        self.assertEqual(after, before)

    def test_async_setup_registers_authenticated_breakdown_view(self):
        registered = []
        hass = types.SimpleNamespace(
            data={},
            http=types.SimpleNamespace(register_view=registered.append),
        )

        with patch.dict(sys.modules, {"custom_components.finanzplaner.http": self.http}):
            asyncio.run(finanzplaner.async_setup(hass, {}))

        self.assertIn(self.http.OverviewBreakdownView, registered)
        self.assertTrue(self.http.OverviewBreakdownView.requires_auth)
        self.assertEqual(
            self.http.OverviewBreakdownView.url,
            "/api/finanzplaner/overview/breakdown",
        )


if __name__ == "__main__":
    unittest.main()
