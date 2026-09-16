import asyncio
import importlib
import sys
import types
import unittest
from copy import deepcopy
from datetime import date
from unittest.mock import patch

from custom_components import finanzplaner
from custom_components.finanzplaner.const import DOMAIN
from custom_components.finanzplaner.core import (
    catalog_id_for_label,
    feed_profile_forecast,
    feed_profile_month_values,
    parse_allocation_payload,
    validate_pet_payload,
    validate_catalog_payload,
    validate_feed_profile_payload,
    validate_plan_item_payload,
    record_feed_profile_purchase,
)
from custom_components.finanzplaner.storage import migrate_store_data


class FeedProfileDomainTests(unittest.TestCase):
    def test_manual_interval_wins_over_average_and_exposes_next_purchase(self):
        profile = {
            "pet_id": "pet-fio",
            "product": "Trockenfutter",
            "package_unit": "1 Sack",
            "expected_cost": 42.0,
            "interval_weeks": 5,
            "purchase_dates": ["2026-07-01", "2026-08-01"],
            "last_purchase_date": "2026-08-01",
            "due_soon_days": 14,
            "active": True,
        }

        result = feed_profile_forecast(profile, today=date(2026, 9, 1))

        self.assertEqual(result["interval_source"], "manual")
        self.assertEqual(result["average_interval_weeks"], 4.43)
        self.assertEqual(result["effective_interval_weeks"], 5.0)
        self.assertEqual(result["next_purchase_date"], "2026-09-05")
        self.assertEqual(result["status"], "due_soon")

    def test_average_interval_is_used_when_no_manual_override_exists(self):
        result = feed_profile_forecast(
            {
                "purchase_dates": ["2026-07-01", "2026-08-01"],
                "last_purchase_date": "2026-08-01",
                "due_soon_days": 14,
            },
            today=date(2026, 8, 20),
        )

        self.assertEqual(result["interval_source"], "average")
        self.assertEqual(result["effective_interval_weeks"], 4.43)
        self.assertEqual(result["next_purchase_date"], "2026-09-01")
        self.assertEqual(result["status"], "due_soon")

    def test_feed_forecast_is_a_concrete_event_without_monthly_double_count(self):
        profile = {
            "active": True,
            "expected_cost": 19.90,
            "interval_weeks": 4,
            "last_purchase_date": "2026-08-20",
        }

        self.assertEqual(
            feed_profile_month_values(profile, "2026-09", today=date(2026, 9, 1)),
            (0.0, -19.90),
        )

    def test_validates_feed_profile_fields_and_pet_snapshot(self):
        result = validate_feed_profile_payload(
            {
                "pet_id": "pet-fio",
                "product": " Trockenfutter ",
                "package_unit": " 1 Sack ",
                "expected_cost": "42,50",
                "interval_weeks": "5",
                "last_purchase_date": "2026-08-01",
                "due_soon_days": 14,
                "active": True,
            },
            {"pet-fio": {"name": "Fio", "pet_type": "Hund"}},
        )

        self.assertEqual(result["product"], "Trockenfutter")
        self.assertEqual(result["package_unit"], "1 Sack")
        self.assertEqual(result["expected_cost"], 42.50)
        self.assertEqual(result["pet_name"], "Fio")
        self.assertEqual(result["pet_type"], "Hund")
        with self.assertRaisesRegex(ValueError, "Futter"):
            validate_feed_profile_payload(
                {"pet_id": "pet-fio", "product": "", "package_unit": "Sack", "expected_cost": 1},
                {"pet-fio": {"name": "Fio"}},
            )

    def test_confirmed_purchase_uses_one_shared_validation_path(self):
        profile = {
            "active": True,
            "purchase_dates": ["2026-08-01"],
        }

        normalized = record_feed_profile_purchase(
            profile, "2026-09-10", today=date(2026, 9, 16)
        )

        self.assertEqual(normalized, "2026-09-10")
        self.assertEqual(profile["last_purchase_date"], "2026-09-10")
        with self.assertRaisesRegex(ValueError, "Zukunft"):
            record_feed_profile_purchase(profile, "2026-09-17", today=date(2026, 9, 16))


class CatalogDomainTests(unittest.TestCase):
    def test_catalogs_are_backfilled_from_legacy_labels(self):
        migrated = migrate_store_data(
            {
                "version": 2,
                "plan_items": [
                    {
                        "name": "Miete",
                        "category": "Wohnen",
                        "area": "Haushalt",
                        "project": "PV-Anlage",
                    }
                ],
                "bookings": [
                    {
                        "allocations": [
                            {"category": "Futter", "area": "Haustiere", "project": None}
                        ]
                    }
                ],
            },
            "Testhaushalt",
        )

        catalogs = migrated["catalogs"]
        self.assertEqual(
            [entry["label"] for entry in catalogs["categories"]],
            ["Futter", "Wohnen"],
        )
        self.assertEqual([entry["label"] for entry in catalogs["areas"]], ["Haushalt", "Haustiere"])
        self.assertEqual([entry["label"] for entry in catalogs["projects"]], ["PV-Anlage"])
        self.assertEqual(
            catalogs["categories"][0]["id"], catalog_id_for_label("categories", "Futter")
        )
        self.assertEqual(
            migrated["plan_items"][0]["category_id"],
            catalog_id_for_label("categories", "Wohnen"),
        )
        self.assertEqual(
            migrated["bookings"][0]["allocations"][0]["area_id"],
            catalog_id_for_label("areas", "Haustiere"),
        )

    def test_catalog_payload_is_strict_and_normalized(self):
        self.assertEqual(
            validate_catalog_payload({"label": "  Hunde  ", "active": True}),
            {"label": "Hunde", "active": True},
        )
        with self.assertRaisesRegex(ValueError, "unbekanntes Feld"):
            validate_catalog_payload({"label": "Hunde", "color": "red"})


class PetDomainTests(unittest.TestCase):
    def test_normalizes_pet_profiles_and_adds_snapshot_defaults(self):
        migrated = migrate_store_data(
            {
                "version": 2,
                "pets": [{"name": "  Fio  ", "pet_type": "Hund"}],
                "feed_profiles": [
                    {
                        "pet_id": "",
                        "product": " Trockenfutter ",
                        "package_unit": "1 Sack",
                        "expected_cost": 42,
                        "last_purchase_date": "2026-08-01",
                    }
                ],
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
        feed_profile = migrated["feed_profiles"][0]
        self.assertTrue(feed_profile["id"].startswith("feed-profile-"))
        self.assertEqual(feed_profile["product"], "Trockenfutter")
        self.assertEqual(feed_profile["purchase_dates"], ["2026-08-01"])

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
                    "catalogs": {
                        "categories": [
                            {
                                "id": "catalog-category-wohnen",
                                "label": "Wohnen",
                                "active": True,
                            }
                        ],
                        "areas": [],
                        "projects": [],
                    },
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

    def test_catalog_ids_are_accepted_for_plan_items_and_allocations(self):
        category_id = self.coordinator.store.data["catalogs"]["categories"][0]["id"]
        plan_result = asyncio.run(
            self.http.PlanItemsView().post(
                self._request(
                    {
                        "name": "Wohnkosten",
                        "direction": "expense",
                        "amount": 100,
                        "frequency_months": 1,
                        "target": "household",
                        "category_id": category_id,
                    }
                )
            )
        )
        plan_item = self.coordinator.store.data["plan_items"][-1]
        self.assertEqual(plan_item["category_id"], category_id)
        self.assertEqual(plan_item["category"], "Wohnen")
        self.assertEqual(plan_result["plan_item"]["category_id"], category_id)

        allocation_result = asyncio.run(
            self.http.BookingAllocationsView().post(
                self._request(
                    {
                        "allocations": [
                            {
                                "target": "household",
                                "amount": 42,
                                "category_id": category_id,
                            }
                        ]
                    }
                ),
                "booking-1",
            )
        )
        allocation = self.coordinator.store.data["bookings"][0]["allocations"][0]
        self.assertEqual(allocation["category_id"], category_id)
        self.assertEqual(allocation["category"], "Wohnen")
        self.assertEqual(
            allocation_result["booking"]["allocations"][0]["category_id"], category_id
        )

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

    def test_feed_profile_can_be_created_and_confirmed_purchase_moves_forecast(self):
        result = asyncio.run(
            self.http.FeedProfilesView().post(
                self._request(
                    {
                        "pet_id": "pet-fio",
                        "product": "Trockenfutter",
                        "package_unit": "1 Sack",
                        "expected_cost": 42.50,
                        "interval_weeks": 5,
                        "last_purchase_date": "2026-08-01",
                        "due_soon_days": 14,
                        "active": True,
                    }
                )
            )
        )
        profile = self.coordinator.store.data["feed_profiles"][-1]
        self.assertEqual(result["feed_profile"]["pet_name"], "Fio")
        self.assertEqual(profile["purchase_dates"], ["2026-08-01"])

        purchased = asyncio.run(
            self.http.FeedProfilePurchaseView().post(
                self._request({"purchase_date": "2026-09-10"}),
                profile["id"],
            )
        )

        self.assertEqual(profile["last_purchase_date"], "2026-09-10")
        self.assertEqual(profile["purchase_dates"], ["2026-08-01", "2026-09-10"])
        self.assertEqual(purchased["purchase_date"], "2026-09-10")
        self.assertEqual(self.coordinator.store.save_count, 2)

    def test_catalogs_can_be_created_renamed_and_archived_reversibly(self):
        created = asyncio.run(
            self.http.CatalogEntriesView().post(
                self._request({"label": " Haustiere ", "active": True}),
                "areas",
            )
        )
        entry = self.coordinator.store.data["catalogs"]["areas"][-1]
        self.assertEqual(created["catalog"]["label"], "Haustiere")
        self.assertTrue(entry["id"].startswith("catalog-area-"))

        self.coordinator.store.data["plan_items"].extend(
            [
                {"area": "Haustiere"},
                {
                    "id": "plan-item-canonical",
                    "name": "Historische Zuordnung",
                    "direction": "expense",
                    "amount": 1,
                    "frequency_months": 1,
                    "target": "household",
                    "active": True,
                    "area": "Haustiere",
                    "area_id": entry["id"],
                },
            ]
        )
        updated = asyncio.run(
            self.http.CatalogEntryView().post(
                self._request({"label": "Tierbedarf", "active": True}),
                "areas",
                entry["id"],
            )
        )
        self.assertEqual(updated["catalog"]["label"], "Tierbedarf")
        self.assertEqual(self.coordinator.store.data["plan_items"][0]["area"], "Tierbedarf")
        self.assertEqual(self.coordinator.store.data["plan_items"][1]["area"], "Haustiere")
        self.assertEqual(self.coordinator.store.data["plan_items"][1]["area_id"], entry["id"])
        asyncio.run(
            self.http.PlanItemView().post(
                self._request({"name": "Historische Zuordnung angepasst"}),
                "plan-item-canonical",
            )
        )
        self.assertEqual(self.coordinator.store.data["plan_items"][1]["area"], "Haustiere")
        self.assertEqual(self.coordinator.store.data["plan_items"][1]["area_id"], entry["id"])
        self.assertEqual(
            [catalog["label"] for catalog in self.coordinator.store.data["catalogs"]["areas"]],
            ["Tierbedarf"],
        )

        archived = asyncio.run(
            self.http.CatalogEntryView().delete(self._request(), "areas", entry["id"])
        )
        self.assertTrue(archived["archived"])
        self.assertFalse(entry["active"])

        reactivated = asyncio.run(
            self.http.CatalogEntryView().post(
                self._request({"label": "Tierbedarf", "active": True}),
                "areas",
                entry["id"],
            )
        )
        self.assertTrue(reactivated["catalog"]["active"])
        self.assertTrue(entry["active"])

        asyncio.run(self.http.CatalogEntryView().delete(self._request(), "areas", entry["id"]))

        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.PlanItemsView().post(
                    self._request(
                        {
                            "name": "Neue Zuordnung",
                            "direction": "expense",
                            "amount": 1,
                            "frequency_months": 1,
                            "target": "household",
                            "area": "Tierbedarf",
                        }
                    )
                )
            )


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
        self.assertIn(http.FeedProfilesView, registered)
        self.assertIn(http.FeedProfileView, registered)
        self.assertIn(http.FeedProfilePurchaseView, registered)
        self.assertIn(http.CatalogsView, registered)
        self.assertIn(http.CatalogEntriesView, registered)
        self.assertIn(http.CatalogEntryView, registered)
        self.assertTrue(http.PetView.requires_auth)


if __name__ == "__main__":
    unittest.main()
