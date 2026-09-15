import asyncio
from copy import deepcopy
import importlib
import sys
import types
import unittest
from unittest.mock import patch

from custom_components import finanzplaner
from custom_components.finanzplaner.const import DOMAIN
from custom_components.finanzplaner.core import parse_allocation_payload


VALID_TARGETS = {"person.alex", "person.sam", "household"}


class AllocationPayloadTests(unittest.TestCase):
    def test_accepts_people_and_household_hunde_allocations(self):
        allocations = parse_allocation_payload(
            [
                {"target": "person.alex", "amount": 60.00},
                {"target": "person.sam", "amount": 20.00},
                {"target": "household", "amount": 20.00, "area": "Hunde"},
            ],
            100.00,
            VALID_TARGETS,
        )

        self.assertEqual([allocation.amount for allocation in allocations], [60.0, 20.0, 20.0])
        self.assertEqual(allocations[-1].area, "Hunde")

    def test_accepts_deterministic_three_way_cent_split(self):
        allocations = parse_allocation_payload(
            [
                {"target": "person.alex", "amount": 33.34},
                {"target": "person.sam", "amount": 33.33},
                {"target": "household", "amount": 33.33},
            ],
            -100.00,
            VALID_TARGETS,
        )

        self.assertEqual([allocation.amount for allocation in allocations], [33.34, 33.33, 33.33])

    def test_rejects_sum_that_is_one_cent_short(self):
        with self.assertRaisesRegex(
            ValueError,
            "Die Aufteilung deckt den Buchungsbetrag nicht centgenau ab\\.",
        ):
            parse_allocation_payload(
                [
                    {"target": "person.alex", "amount": 60.00},
                    {"target": "person.sam", "amount": 20.00},
                    {"target": "household", "amount": 19.99},
                ],
                100.00,
                VALID_TARGETS,
            )

    def test_rejects_invalid_payload_shapes_and_values(self):
        invalid_payloads = (
            {"target": "person.alex", "amount": 100.00},
            [],
            [{"target": "person.unknown", "amount": 100.00}],
            [
                {"target": "person.alex", "amount": 50.00},
                {"target": "person.alex", "amount": 50.00},
            ],
            [{"target": "person.alex", "amount": -100.00}],
            [{"target": "person.alex", "amount": 100.001}],
            [{"target": "person.alex", "amount": True}],
            [{"target": "person.alex", "amount": float("inf")}],
            [{"target": "person.alex", "amount": 100.00, "area": "Haushalt"}],
            [{"target": "Hunde", "amount": 100.00}],
            [{"target": "person.alex", "amount": 100.00, "category": 1}],
            [{"target": "person.alex", "amount": 100.00, "project": False}],
        )

        for payload in invalid_payloads:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                parse_allocation_payload(payload, 100.00, VALID_TARGETS)


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


class BookingAllocationViewTests(unittest.TestCase):
    def setUp(self):
        self.http, coordinator_type, self.bad_request, self.not_found = _load_http_module()

        class FakeStore:
            def __init__(self):
                self.data = {
                    "accounts": [
                        {"id": "account-1", "owner_targets": ["person.removed"]}
                    ],
                    "bookings": [
                        {
                            "id": "booking-1",
                            "account": "AT123456789012345678",
                            "amount": -100.00,
                            "allocations": [],
                            "status": "unresolved",
                        }
                    ],
                }
                self.save_count = 0

            async def async_save(self):
                self.save_count += 1

        self.coordinator = coordinator_type()
        self.coordinator.store = FakeStore()
        self.coordinator.data = self.coordinator.store.data
        self.coordinator.refresh_count = 0

        async def async_refresh():
            self.coordinator.refresh_count += 1

        self.coordinator.async_refresh = async_refresh
        states = [
            types.SimpleNamespace(domain="person", entity_id="person.alex"),
            types.SimpleNamespace(domain="person", entity_id="person.sam"),
            types.SimpleNamespace(domain="light", entity_id="light.kitchen"),
        ]
        hass = types.SimpleNamespace(
            data={DOMAIN: {"entry": self.coordinator}},
            states=types.SimpleNamespace(async_all=lambda: states),
        )
        self.app = {"hass": hass}

    def _request(self, payload):
        app = self.app

        class Request:
            async def json(self):
                return payload

        request = Request()
        request.app = app
        return request

    def test_custom_view_requires_authentication(self):
        self.assertIs(self.http.BookingAllocationsView.requires_auth, True)

    def test_custom_view_saves_validated_allocations_and_returns_redacted_booking(self):
        result = asyncio.run(
            self.http.BookingAllocationsView().post(
                self._request(
                    [
                        {"target": "person.alex", "amount": 60.00},
                        {"target": "person.sam", "amount": 20.00},
                        {
                            "target": "household",
                            "amount": 20.00,
                            "area": "Hunde",
                            "category": "Tierbedarf",
                            "project": "Alltag",
                        },
                    ]
                ),
                "booking-1",
            )
        )

        booking = self.coordinator.store.data["bookings"][0]
        self.assertEqual(booking["status"], "resolved")
        self.assertEqual(booking["allocations"][2]["area"], "Hunde")
        self.assertEqual(booking["allocations"][2]["category"], "Tierbedarf")
        self.assertEqual(self.coordinator.store.save_count, 1)
        self.assertEqual(self.coordinator.refresh_count, 1)
        self.assertEqual(result["booking"]["account"], "…5678")
        self.assertEqual(booking["account"], "AT123456789012345678")

    def test_invalid_custom_payload_does_not_mutate_or_save(self):
        before = deepcopy(self.coordinator.store.data)

        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.BookingAllocationsView().post(
                    self._request([{"target": "person.alex", "amount": 99.99}]),
                    "booking-1",
                )
            )

        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_account_owner_that_is_not_a_live_person_is_rejected(self):
        before = deepcopy(self.coordinator.store.data)

        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.BookingAllocationsView().post(
                    self._request([{"target": "person.removed", "amount": 100.00}]),
                    "booking-1",
                )
            )

        self.assertEqual(self.coordinator.store.data, before)

    def test_unknown_booking_returns_not_found_without_saving(self):
        with self.assertRaises(self.not_found):
            asyncio.run(
                self.http.BookingAllocationsView().post(
                    self._request([{"target": "household", "amount": 100.00}]),
                    "missing",
                )
            )

        self.assertEqual(self.coordinator.store.save_count, 0)

    def test_legacy_view_uses_the_same_live_target_and_cent_rules(self):
        result = asyncio.run(
            self.http.BookingAssignmentView().post(
                self._request(
                    {
                        "targets": ["person.alex", "person.sam", "household"],
                        "area": "Hunde",
                    }
                ),
                "booking-1",
            )
        )

        self.assertEqual(
            [item["amount"] for item in result["booking"]["allocations"]],
            [33.34, 33.33, 33.33],
        )
        self.assertTrue(all(item["area"] == "Hunde" for item in result["booking"]["allocations"]))
        self.assertEqual(self.coordinator.store.save_count, 1)
        self.assertEqual(self.coordinator.refresh_count, 1)


class BookingAllocationRegistrationTests(unittest.TestCase):
    def test_async_setup_registers_custom_allocation_view(self):
        http, _, _, _ = _load_http_module()
        registered = []
        hass = types.SimpleNamespace(
            data={},
            http=types.SimpleNamespace(register_view=registered.append),
        )

        with patch.dict(sys.modules, {"custom_components.finanzplaner.http": http}):
            asyncio.run(finanzplaner.async_setup(hass, {}))

        self.assertIn(http.BookingAllocationsView, registered)


if __name__ == "__main__":
    unittest.main()
