import asyncio
import importlib
import sys
import types
import unittest
from copy import deepcopy
from unittest.mock import patch

from custom_components import finanzplaner
from custom_components.finanzplaner.const import DOMAIN
from custom_components.finanzplaner.core import (
    parse_allocation_payload,
    validate_pet_payload,
    validate_plan_item_payload,
)
from custom_components.finanzplaner.storage import migrate_store_data


class PetDomainTests(unittest.TestCase):
    def test_normalizes_pet_profiles_and_adds_snapshot_defaults(self):
        migrated = migrate_store_data(
            {
                "version": 2,
                "pets": [{"name": "  Fio  ", "pet_type": "Hund"}],
                "plan_items": [{"name": "Futter", "pet_id": None}],
                "bookings": [
                    {
                        "id": "booking-1",
                        "allocations": [
                            {"target": "household", "amount": 42.0}
                        ],
                    }
                ],
            },
            "Testhaushalt",
        )

        pet = migrated["pets"][0]
        self.assertTrue(pet["id"].startswith("pet-"))
        self.assertEqual(pet["name"], "Fio")
        self.assertEqual(pet["pet_type"], "Hund")
        self.assertTrue(pet["active"])
        self.assertIsNone(migrated["plan_items"][0]["pet_name"])
        self.assertIsNone(migrated["bookings"][0]["allocations"][0]["pet_id"])

    def test_validates_pet_reference_without_turning_it_into_a_person_target(self):
        pet = {"id": "pet-fio", "name": "Fio", "pet_type": "Hund", "active": True}
        result = validate_plan_item_payload(
            {
                "name": "Futter Fio",
                "direction": "expense",
                "amount": 35,
                "frequency_months": 1,
                "target": "household",
                "pet_id": "pet-fio",
            },
            {"household"},
            valid_pets={"pet-fio": pet},
        )

        self.assertEqual(result["pet_id"], "pet-fio")
        self.assertEqual(result["pet_name"], "Fio")
        self.assertEqual(result["pet_type"], "Hund")
        self.assertEqual(result["target"], "household")

        with self.assertRaisesRegex(ValueError, "Tier"):
            validate_plan_item_payload(
                {
                    "name": "Fremdes Futter",
                    "direction": "expense",
                    "amount": 35,
                    "frequency_months": 1,
                    "pet_id": "pet-unknown",
                },
                {"household"},
                valid_pets={"pet-fio": pet},
            )

    def test_allocation_keeps_pet_snapshot_and_accepts_generic_area(self):
        allocations = parse_allocation_payload(
            [
                {
                    "target": "household",
                    "amount": 42.0,
                    "area": "Haustiere",
                    "category": "Futter",
                    "pet_id": "pet-fio",
                }
            ],
            -42.0,
            {"household"},
            valid_pets={
                "pet-fio": {
                    "id": "pet-fio",
                    "name": "Fio",
                    "pet_type": "Hund",
                    "active": True,
                }
            },
        )

        self.assertEqual(allocations[0].area, "Haustiere")
        self.assertEqual(allocations[0].pet_id, "pet-fio")
        self.assertEqual(allocations[0].pet_name, "Fio")
        self.assertEqual(allocations[0].pet_type, "Hund")

    def test_pet_payload_requires_name_and_normalizes_optional_type(self):
        self.assertEqual(
            validate_pet_payload(
                {"name": " Fio ", "pet_type": " Hund ", "active": True}
            ),
            {"name": "Fio", "pet_type": "Hund", "active": True},
        )
        with self.assertRaises(ValueError):
            validate_pet_payload({"name": "", "pet_type": "Hund", "active": True})


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


class PetApiTests(unittest.TestCase):
    def setUp(self):
        self.http, coordinator_type, self.bad_request, self.not_found = _load_http_module()

        class FakeStore:
            def __init__(self):
                self.data = {
                    "pets": [
                        {
                            "id": "pet-fio",
                            "name": "Fio",
                            "pet_type": "Hund",
                            "active": True,
                        }
                    ],
                    "plan_items": [],
                    "bookings": [
                        {
                            "id": "booking-1",
                            "amount": -42.0,
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

        async def async_refresh_data():
            self.coordinator.refresh_count += 1

        async def async_refresh():
            self.coordinator.refresh_count += 1

        self.coordinator.async_refresh_data = async_refresh_data
        self.coordinator.async_refresh = async_refresh
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
        class Request:
            async def json(inner_self):
                return payload

        request = Request()
        request.app = self.app
        return request

    def test_pet_views_are_authenticated_and_list_without_mutating_store(self):
        result = asyncio.run(self.http.PetsView().get(self._request()))

        self.assertTrue(self.http.PetsView.requires_auth)
        self.assertEqual(result["pets"][0]["name"], "Fio")
        self.assertEqual(self.coordinator.store.save_count, 0)

    def test_create_and_archive_pet(self):
        result = asyncio.run(
            self.http.PetsView().post(
                self._request({"name": "Mimi", "pet_type": "Katze", "active": True})
            )
        )
        created = self.coordinator.store.data["pets"][-1]
        self.assertTrue(created["id"].startswith("pet-"))
        self.assertEqual(result["pet"]["pet_type"], "Katze")
        self.assertEqual(self.coordinator.store.save_count, 1)

        archived = asyncio.run(
            self.http.PetView().delete(self._request(), created["id"])
        )
        self.assertFalse(created["active"])
        self.assertTrue(archived["archived"])
        self.assertEqual(self.coordinator.store.save_count, 2)

    def test_plan_item_and_allocation_store_pet_snapshots(self):
        plan_result = asyncio.run(
            self.http.PlanItemsView().post(
                self._request(
                    {
                        "name": "Futter Fio",
                        "direction": "expense",
                        "amount": 42,
                        "frequency_months": 1,
                        "target": "household",
                        "pet_id": "pet-fio",
                    }
                )
            )
        )
        plan_item = self.coordinator.store.data["plan_items"][-1]
        self.assertEqual(plan_item["pet_id"], "pet-fio")
        self.assertEqual(plan_item["pet_name"], "Fio")
        self.assertEqual(plan_result["plan_item"]["pet_type"], "Hund")

        allocation_result = asyncio.run(
            self.http.BookingAllocationsView().post(
                self._request(
                    {
                        "allocations": [
                            {
                                "target": "household",
                                "amount": 42,
                                "area": "Haustiere",
                                "pet_id": "pet-fio",
                            }
                        ]
                    }
                ),
                "booking-1",
            )
        )
        allocation = self.coordinator.store.data["bookings"][0]["allocations"][0]
        self.assertEqual(allocation["pet_name"], "Fio")
        self.assertEqual(allocation["pet_type"], "Hund")
        self.assertEqual(allocation_result["booking"]["status"], "resolved")

    def test_invalid_pet_reference_does_not_mutate_or_save(self):
        before = deepcopy(self.coordinator.store.data)
        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.BookingAllocationsView().post(
                    self._request(
                        {
                            "allocations": [
                                {
                                    "target": "household",
                                    "amount": 42,
                                    "pet_id": "pet-unknown",
                                }
                            ]
                        }
                    ),
                    "booking-1",
                )
            )
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)


class PetRegistrationTests(unittest.TestCase):
    def test_async_setup_registers_pet_views(self):
        http, _, _, _ = _load_http_module()
        registered = []
        hass = types.SimpleNamespace(
            data={},
            http=types.SimpleNamespace(register_view=registered.append),
        )

        with patch.dict(sys.modules, {"custom_components.finanzplaner.http": http}):
            asyncio.run(finanzplaner.async_setup(hass, {}))

        self.assertIn(http.PetsView, registered)
        self.assertIn(http.PetView, registered)
        self.assertTrue(http.PetView.requires_auth)


if __name__ == "__main__":
    unittest.main()
