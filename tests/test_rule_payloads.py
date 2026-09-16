import asyncio
from copy import deepcopy
import importlib
import sys
import types
import unittest
from unittest.mock import patch

from custom_components import finanzplaner
from custom_components.finanzplaner import storage
from custom_components.finanzplaner.const import DOMAIN


def _load_http_module():
    class HTTPBadRequest(Exception):
        status_code = 400

        def __init__(self, *, text):
            super().__init__(text)
            self.text = text

    class HTTPNotFound(Exception):
        status_code = 404

        def __init__(self, *, text):
            super().__init__(text)
            self.text = text

    class HTTPUnauthorized(Exception):
        status_code = 401

    fake_web = types.ModuleType("aiohttp.web")
    fake_web.HTTPBadRequest = HTTPBadRequest
    fake_web.HTTPNotFound = HTTPNotFound
    fake_web.HTTPUnauthorized = HTTPUnauthorized
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
    return module, FakeCoordinator, HTTPBadRequest, HTTPNotFound, HTTPUnauthorized


class RuleStorageTests(unittest.TestCase):
    def test_current_store_adds_empty_rules_without_changing_bookings(self):
        data = storage.normalize_current_store_data(
            {
                "version": storage.STORAGE_VERSION,
                "rules": {"invalid": True},
                "bookings": [{"id": "booking-1"}],
            },
            "Testhaushalt",
        )

        self.assertEqual(data["rules"], [])
        self.assertEqual(data["bookings"][0]["id"], "booking-1")

    def test_legacy_migration_adds_empty_rules_without_changing_bookings(self):
        data = storage.migrate_store_data(
            {
                "version": 1,
                "rules": "invalid",
                "bookings": [{"id": "booking-1", "account": ""}],
            },
            "Testhaushalt",
        )

        self.assertEqual(data["rules"], [])
        self.assertEqual(data["bookings"][0]["id"], "booking-1")


class RuleViewTests(unittest.TestCase):
    def setUp(self):
        (
            self.http,
            coordinator_type,
            self.bad_request,
            self.not_found,
            self.unauthorized,
        ) = _load_http_module()

        class FakeStore:
            def __init__(self):
                self.data = {
                    "settings": {"household_name": "Testhaushalt"},
                    "accounts": [
                        {
                            "id": "account-1",
                            "label": "Gemeinsames Girokonto",
                            "iban": "AT123456789012345678",
                            "account_reference": "AT123456789012345678",
                            "bank": "Testbank",
                            "owner_targets": ["person.alex"],
                            "active": True,
                        }
                    ],
                    "catalogs": {
                        "categories": [
                            {
                                "id": "category-groceries",
                                "label": "Lebensmittel",
                                "active": True,
                            }
                        ],
                        "areas": [
                            {
                                "id": "area-household",
                                "label": "Haushalt",
                                "active": True,
                            }
                        ],
                        "projects": [
                            {
                                "id": "project-renovation",
                                "label": "Renovierung",
                                "active": True,
                            }
                        ],
                    },
                    "pets": [
                        {
                            "id": "pet-fio",
                            "name": "Fio",
                            "pet_type": "Hund",
                            "active": True,
                        }
                    ],
                    "rules": [
                        {
                            "id": "rule-1",
                            "label": "Bestehende Regel",
                            "active": True,
                            "priority": 100,
                            "account_id": "account-1",
                            "counterparty": "Supermarkt",
                            "purpose_contains": None,
                            "allocations": [
                                {
                                    "target": "household",
                                    "share_percent": 100.0,
                                    "area_id": None,
                                    "category_id": "category-groceries",
                                    "project_id": None,
                                    "pet_id": None,
                                }
                            ],
                            "created_at": "2026-09-01T08:00:00+00:00",
                            "updated_at": "2026-09-01T08:00:00+00:00",
                        }
                    ],
                    "bookings": [
                        {
                            "id": "booking-resolved",
                            "account_id": "account-1",
                            "counterparty": " Tierladen GmbH ",
                            "purpose": "Futter und Zubehör",
                            "amount": -30.0,
                            "status": "resolved",
                            "allocations": [
                                {
                                    "target": "household",
                                    "amount": 10.0,
                                    "area_id": "area-household",
                                    "category_id": "category-groceries",
                                    "project_id": None,
                                    "pet_id": "pet-fio",
                                },
                                {
                                    "target": "person.alex",
                                    "amount": 20.0,
                                    "area_id": None,
                                    "category_id": None,
                                    "project_id": "project-renovation",
                                    "pet_id": None,
                                },
                            ],
                        },
                        {
                            "id": "booking-unresolved",
                            "account_id": "account-1",
                            "counterparty": "Offene Buchung",
                            "amount": -15.0,
                            "status": "unresolved",
                            "allocations": [],
                        },
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

    def _request(self, payload=None, *, authenticated=True):
        class Request:
            async def json(inner_self):
                return payload

        request = Request()
        request.app = self.app
        request.authenticated = authenticated
        return request

    @staticmethod
    def _valid_rule_payload():
        return {
            "label": "  Strom   Abschlag  ",
            "priority": 250,
            "account_id": "  account-1  ",
            "counterparty": "  Energie   AG  ",
            "purpose_contains": "  Monats   Abschlag  ",
            "allocations": [
                {
                    "target": "household",
                    "share_percent": 100,
                    "area_id": "area-household",
                    "category_id": None,
                    "project_id": None,
                    "pet_id": None,
                }
            ],
        }

    def test_rules_get_requires_authentication(self):
        with self.assertRaises(self.unauthorized) as raised:
            asyncio.run(
                self.http.RulesView().get(
                    self._request(authenticated=False)
                )
            )

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(self.coordinator.store.save_count, 0)

    def test_rules_post_normalizes_and_persists_rule(self):
        existing_ids = {
            rule["id"] for rule in self.coordinator.store.data["rules"]
        }

        with patch.object(
            self.http,
            "uuid4",
            return_value=types.SimpleNamespace(hex="0123456789abcdef0123456789abcdef"),
        ):
            result = asyncio.run(
                self.http.RulesView().post(
                    self._request(self._valid_rule_payload())
                )
            )

        created = self.coordinator.store.data["rules"][-1]
        self.assertNotIn(created["id"], existing_ids)
        self.assertEqual(len(created["id"]), 32)
        self.assertEqual(created["label"], "Strom Abschlag")
        self.assertEqual(created["account_id"], "account-1")
        self.assertEqual(created["counterparty"], "Energie AG")
        self.assertEqual(created["purpose_contains"], "Monats Abschlag")
        self.assertTrue(created["active"])
        self.assertEqual(result["rule"]["id"], created["id"])
        self.assertEqual(self.coordinator.store.save_count, 1)
        self.assertEqual(self.coordinator.refresh_count, 1)

    def test_rule_post_updates_only_editable_fields(self):
        original = self.coordinator.store.data["rules"][0]
        created_at = original["created_at"]

        result = asyncio.run(
            self.http.RuleView().post(
                self._request({"label": "  Geänderte   Regel  ", "priority": 300}),
                "rule-1",
            )
        )

        updated = self.coordinator.store.data["rules"][0]
        self.assertEqual(updated["id"], "rule-1")
        self.assertEqual(updated["created_at"], created_at)
        self.assertEqual(updated["label"], "Geänderte Regel")
        self.assertEqual(updated["priority"], 300)
        self.assertNotEqual(updated["updated_at"], "2026-09-01T08:00:00+00:00")
        self.assertEqual(result["rule"]["id"], "rule-1")
        self.assertEqual(self.coordinator.store.save_count, 1)

    def test_invalid_rule_post_does_not_mutate_or_save(self):
        before = deepcopy(self.coordinator.store.data)
        invalid = deepcopy(self.coordinator.store.data["rules"][0]["allocations"])
        invalid[0]["target"] = "person.unknown"

        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.RuleView().post(
                    self._request({"allocations": invalid}),
                    "rule-1",
                )
            )

        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_rule_archive_sets_active_false_without_deleting(self):
        result = asyncio.run(
            self.http.RuleView().post(
                self._request({"active": False}),
                "rule-1",
            )
        )

        rules = self.coordinator.store.data["rules"]
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules[0]["id"], "rule-1")
        self.assertFalse(rules[0]["active"])
        self.assertFalse(result["rule"]["active"])
        self.assertEqual(self.coordinator.store.save_count, 1)

    def test_from_booking_requires_resolved_booking(self):
        before = deepcopy(self.coordinator.store.data)

        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.RuleFromBookingView().post(
                    self._request({}),
                    "booking-unresolved",
                )
            )

        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_from_resolved_booking_creates_rule_template(self):
        before = deepcopy(self.coordinator.store.data)

        result = asyncio.run(
            self.http.RuleFromBookingView().post(
                self._request({"label": "  Fio   Einkauf  "}),
                "booking-resolved",
            )
        )

        template = result["rule"]
        self.assertEqual(template["label"], "Fio Einkauf")
        self.assertEqual(template["account_id"], "account-1")
        self.assertEqual(template["counterparty"], "Tierladen GmbH")
        self.assertIsNone(template["purpose_contains"])
        self.assertEqual(
            [allocation["share_percent"] for allocation in template["allocations"]],
            [33.33, 66.67],
        )
        self.assertEqual(template["allocations"][0]["pet_id"], "pet-fio")
        self.assertEqual(
            template["allocations"][1]["project_id"], "project-renovation"
        )
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_rules_get_masks_account_references(self):
        result = asyncio.run(self.http.RulesView().get(self._request()))

        account = result["rules"][0]["account"]
        self.assertEqual(account["label"], "Gemeinsames Girokonto")
        self.assertEqual(account["account_reference"], "…5678")
        self.assertEqual(account["iban_masked"], "•••• 5678")
        self.assertNotIn("AT123456789012345678", str(result))
        self.assertEqual(self.coordinator.store.save_count, 0)

    def test_rules_get_does_not_repair_malformed_store(self):
        self.coordinator.store.data["rules"] = {"invalid": True}
        before = deepcopy(self.coordinator.store.data)

        result = asyncio.run(self.http.RulesView().get(self._request()))

        self.assertEqual(result["rules"], [])
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)


class UnresolvedRuleProjectionTests(unittest.TestCase):
    setUp = RuleViewTests.setUp
    _request = RuleViewTests._request

    def test_unresolved_list_exposes_suggestion_without_mutating_store(self):
        booking = {
            "id": "booking-1",
            "status": "unresolved",
            "account_id": "account-giro",
            "counterparty": "Supermarkt AG",
            "purpose": "Einkauf",
            "amount": -42.37,
            "allocations": [],
        }
        self.coordinator.store.data["accounts"] = [{"id": "account-giro"}]
        self.coordinator.store.data["bookings"] = [booking]
        self.coordinator.store.data["rules"] = [{
            "id": "rule-1",
            "label": "Supermarkt",
            "active": True,
            "priority": 100,
            "account_id": "account-giro",
            "counterparty": "Supermarkt AG",
            "purpose_contains": None,
            "allocations": [{
                "target": "household",
                "share_percent": 100.0,
                "area_id": None,
                "category_id": None,
                "project_id": None,
                "pet_id": None,
            }],
        }]

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        self.assertEqual(body["bookings"][0]["status"], "suggested")
        self.assertEqual(body["bookings"][0]["suggestion"]["rule_id"], "rule-1")
        self.assertEqual(booking["status"], "unresolved")
        self.assertEqual(booking["allocations"], [])

    def test_conflicting_rules_are_visible_without_selection(self):
        booking = {
            "id": "booking-1",
            "status": "unresolved",
            "account_id": "account-1",
            "counterparty": "Supermarkt",
            "purpose": "Einkauf",
            "amount": -42.37,
            "allocations": [],
        }
        second_rule = deepcopy(self.coordinator.store.data["rules"][0])
        second_rule["id"] = "rule-2"
        self.coordinator.store.data["bookings"] = [booking]
        self.coordinator.store.data["rules"].append(second_rule)

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        projected = body["bookings"][0]
        self.assertEqual(projected["status"], "conflict")
        self.assertEqual(set(projected["conflicts"]), {"rule-1", "rule-2"})
        self.assertEqual(booking["status"], "unresolved")
        self.assertEqual(booking["allocations"], [])

    def test_invalid_rule_reference_stays_unresolved_with_reason(self):
        booking = {
            "id": "booking-1",
            "status": "unresolved",
            "account_id": "account-1",
            "counterparty": "Supermarkt",
            "purpose": "Einkauf",
            "amount": -42.37,
            "allocations": [],
        }
        self.coordinator.store.data["catalogs"]["categories"][0]["active"] = False
        self.coordinator.store.data["bookings"] = [booking]

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        projected = body["bookings"][0]
        self.assertEqual(projected["status"], "unresolved")
        self.assertIn("Keine aktive Regel", projected["reason"])
        self.assertEqual(booking["status"], "unresolved")
        self.assertEqual(booking["allocations"], [])

    def test_resolved_booking_is_not_returned_by_unresolved_view(self):
        self.coordinator.store.data["bookings"] = [{
            "id": "booking-resolved",
            "status": "resolved",
            "allocations": [],
        }]

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        self.assertEqual(body["bookings"], [])


class RuleRegistrationTests(unittest.TestCase):
    def test_async_setup_registers_authenticated_rule_views(self):
        http, _, _, _, _ = _load_http_module()
        registered = []
        hass = types.SimpleNamespace(
            data={},
            http=types.SimpleNamespace(register_view=registered.append),
        )

        with patch.dict(sys.modules, {"custom_components.finanzplaner.http": http}):
            asyncio.run(finanzplaner.async_setup(hass, {}))

        for view in (http.RulesView, http.RuleView, http.RuleFromBookingView):
            with self.subTest(view=view.__name__):
                self.assertIn(view, registered)
                self.assertIs(view.requires_auth, True)


if __name__ == "__main__":
    unittest.main()
