import asyncio
from copy import deepcopy
import importlib
import sys
import types
import unittest
from unittest.mock import patch

from custom_components import finanzplaner
from custom_components.finanzplaner.const import DOMAIN


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


class AccountPayloadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http, _, _, _ = _load_http_module()

    def test_account_payload_masks_iban_but_keeps_last_four_digits(self):
        payload = self.http.account_payload(
            {
                "id": "account-1",
                "label": "Giro",
                "bank": "Erste Bank",
                "iban": " at12 3456 7890 1234 5678 ",
            }
        )

        self.assertEqual(payload["label"], "Giro")
        self.assertEqual(payload["bank"], "Erste Bank")
        self.assertEqual(payload["iban_masked"], "•••• 5678")
        self.assertNotIn("iban", payload)

    def test_account_payload_redacts_iban_used_as_account_reference(self):
        payload = self.http.account_payload(
            {
                "iban": "AT123456789012345678",
                "account_reference": "AT123456789012345678",
            }
        )

        self.assertEqual(payload["account_reference"], "…5678")
        self.assertNotIn("AT123456789012345678", str(payload))

    def test_account_payload_masks_non_iban_reference_without_mutating_store(self):
        account = {
            "label": "Importkonto",
            "iban": None,
            "account_reference": "BANK-ACCOUNT-42",
        }

        payload = self.http.account_payload(account)

        self.assertEqual(payload["label"], "Importkonto")
        self.assertEqual(payload["account_reference"], "…T-42")
        self.assertNotIn("BANK-ACCOUNT-42", str(payload))
        self.assertEqual(account["account_reference"], "BANK-ACCOUNT-42")

    def test_account_payload_does_not_mutate_internal_account(self):
        account = {"id": "account-1", "iban": "AT123456789012345678"}

        self.http.account_payload(account)

        self.assertEqual(account["iban"], "AT123456789012345678")

    def test_account_payload_masks_nested_iban_strings_without_mutating_input(self):
        account = {
            "iban": "AT123456789012345678",
            "meta": {
                "note": "Zahlung von AT123456789012345678",
                "history": ["AT123456789012345678", {"text": "Keine IBAN"}],
            },
        }

        payload = self.http.account_payload(account)

        self.assertEqual(payload["meta"]["note"], "Zahlung von …5678")
        self.assertEqual(payload["meta"]["history"][0], "…5678")
        self.assertEqual(account["meta"]["note"], "Zahlung von AT123456789012345678")
        self.assertEqual(account["meta"]["history"][0], "AT123456789012345678")

    def test_account_update_accepts_multiple_live_people_and_household(self):
        result = self.http.validate_account_update(
            {
                "label": "Gemeinsames Girokonto",
                "owner_targets": ["person.alex", "person.sam", "household"],
                "active": True,
            },
            {"person.alex", "person.sam", "household"},
        )

        self.assertEqual(result["label"], "Gemeinsames Girokonto")
        self.assertEqual(
            result["owner_targets"],
            ["person.alex", "person.sam", "household"],
        )
        self.assertIs(result["active"], True)

    def test_account_update_accepts_bank_and_valid_iban(self):
        result = self.http.validate_account_update(
            {
                "label": "Giro",
                "bank": " Erste Bank ",
                "iban": "DE89 3704 0044 0532 0130 00",
                "owner_targets": [],
                "active": True,
            },
            {"household"},
        )

        self.assertEqual(result["bank"], "Erste Bank")
        self.assertEqual(result["iban"], "DE89370400440532013000")

    def test_account_update_accepts_valid_austrian_iban(self):
        result = self.http.validate_account_update(
            {
                "label": "Österreichisches Konto",
                "iban": "AT61 1904 3002 3457 3201",
                "owner_targets": [],
                "active": True,
            },
            {"household"},
        )

        self.assertEqual(result["iban"], "AT611904300234573201")

    def test_account_update_rejects_malformed_iban(self):
        with self.assertRaises(ValueError):
            self.http.validate_account_update(
                {
                    "label": "Giro",
                    "iban": "DE89370400440532013001",
                    "owner_targets": [],
                    "active": True,
                },
                {"household"},
            )

    def test_account_update_rejects_unknown_country_and_wrong_country_length(self):
        invalid_ibans = (
            "ZZ89 3704 0044 0532 0130 00",
            "DE89 3704 0044 0532 013",
        )

        for iban in invalid_ibans:
            with self.subTest(iban=iban), self.assertRaises(ValueError):
                self.http.validate_account_update(
                    {
                        "label": "Giro",
                        "iban": iban,
                        "owner_targets": [],
                        "active": True,
                    },
                    {"household"},
                )

    def test_account_update_rejects_unknown_target(self):
        with self.assertRaises(ValueError):
            self.http.validate_account_update(
                {
                    "label": "Giro",
                    "owner_targets": ["person.unknown"],
                    "active": True,
                },
                {"person.alex", "household"},
            )

    def test_account_update_rejects_duplicate_target(self):
        with self.assertRaises(ValueError):
            self.http.validate_account_update(
                {
                    "label": "Giro",
                    "owner_targets": ["person.alex", "person.alex"],
                    "active": True,
                },
                {"person.alex", "household"},
            )

    def test_account_update_rejects_invalid_fields(self):
        invalid_payloads = (
            None,
            {"label": " ", "owner_targets": [], "active": True},
            {"label": "Giro", "owner_targets": "person.alex", "active": True},
            {"label": "Giro", "owner_targets": [1], "active": True},
            {"label": "Giro", "owner_targets": [], "active": 1},
        )

        for payload in invalid_payloads:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                self.http.validate_account_update(payload, {"household"})


class AccountViewTests(unittest.TestCase):
    def setUp(self):
        self.http, coordinator_type, self.bad_request, self.not_found = (
            _load_http_module()
        )

        class FakeStore:
            def __init__(self):
                self.data = {
                    "accounts": [
                        {
                            "id": "account-1",
                            "label": "Giro",
                            "iban": "AT123456789012345678",
                            "account_reference": "AT123456789012345678",
                            "currency": "EUR",
                            "owner_targets": [],
                            "active": True,
                            "created_at": "2026-09-01T00:00:00+00:00",
                            "updated_at": "2026-09-01T00:00:00+00:00",
                        }
                    ],
                    "bookings": [
                        {
                            "id": "booking-1",
                            "account_id": "account-1",
                            "amount": -25.0,
                            "allocations": [
                                {
                                    "target": "household",
                                    "amount": 25.0,
                                    "area": "Hunde",
                                    "category": "Tierbedarf",
                                    "project": None,
                                }
                            ],
                            "status": "resolved",
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

    def test_account_views_require_authentication(self):
        self.assertIs(self.http.AccountsView.requires_auth, True)
        self.assertIs(self.http.AccountView.requires_auth, True)

    def test_dynamic_views_use_home_assistant_route_placeholders(self):
        self.assertEqual(self.http.AccountView.url, "/api/finanzplaner/accounts/{account_id}")
        self.assertEqual(self.http.BookingAssignmentView.url, "/api/finanzplaner/bookings/{booking_id}")
        self.assertEqual(self.http.BookingAllocationsView.url, "/api/finanzplaner/bookings/{booking_id}/allocations")

    def test_account_update_re_resolves_after_request_json_replaces_store_data(self):
        replacement = {
            "accounts": [
                {
                    "id": "account-1",
                    "label": "Aktuelles Konto",
                    "owner_targets": [],
                    "active": True,
                }
            ],
            "bookings": [],
        }
        original = self.coordinator.store.data

        class ReloadingRequest:
            app = self.app

            async def json(self):
                self.app["hass"].data[DOMAIN]["entry"].store.data = replacement
                return {"label": "Nach Reload", "owner_targets": ["person.alex"], "active": False}

        result = asyncio.run(self.http.AccountView().post(ReloadingRequest(), "account-1"))

        self.assertEqual(replacement["accounts"][0]["label"], "Nach Reload")
        self.assertEqual(replacement["accounts"][0]["owner_targets"], ["person.alex"])
        self.assertFalse(replacement["accounts"][0]["active"])
        self.assertEqual(result["account"]["label"], "Nach Reload")
        self.assertEqual(original["accounts"][0]["label"], "Giro")

    def test_get_returns_masked_accounts_without_mutating_store(self):
        before = deepcopy(self.coordinator.store.data)

        result = asyncio.run(self.http.AccountsView().get(self._request()))

        self.assertEqual(result["accounts"][0]["iban_masked"], "•••• 5678")
        self.assertNotIn("iban", result["accounts"][0])
        self.assertNotIn("AT123456789012345678", str(result))
        self.assertEqual(self.coordinator.store.data, before)

    def test_post_updates_only_editable_fields_then_saves_and_refreshes(self):
        result = asyncio.run(
            self.http.AccountView().post(
                self._request(
                    {
                        "label": " Haushaltskonto ",
                        "owner_targets": ["person.alex", "household"],
                        "active": False,
                    }
                ),
                "account-1",
            )
        )

        account = self.coordinator.store.data["accounts"][0]
        self.assertEqual(account["label"], "Haushaltskonto")
        self.assertEqual(account["owner_targets"], ["person.alex", "household"])
        self.assertIs(account["active"], False)
        self.assertEqual(account["iban"], "AT123456789012345678")
        self.assertNotEqual(account["updated_at"], "2026-09-01T00:00:00+00:00")
        self.assertEqual(self.coordinator.store.save_count, 1)
        self.assertEqual(self.coordinator.refresh_count, 1)
        self.assertNotIn("iban", result["account"])
        self.assertNotIn("AT123456789012345678", str(result))

    def test_post_persists_bank_and_new_iban_without_returning_full_iban(self):
        result = asyncio.run(
            self.http.AccountView().post(
                self._request(
                    {
                        "label": "Giro",
                        "bank": " Erste Bank ",
                        "iban": "DE89 3704 0044 0532 0130 00",
                        "owner_targets": [],
                        "active": True,
                    }
                ),
                "account-1",
            )
        )

        account = self.coordinator.store.data["accounts"][0]
        self.assertEqual(account["bank"], "Erste Bank")
        self.assertEqual(account["iban"], "DE89370400440532013000")
        self.assertEqual(result["account"]["bank"], "Erste Bank")
        self.assertEqual(result["account"]["iban_masked"], "•••• 3000")
        self.assertNotIn("DE89370400440532013000", str(result))

    def test_post_with_empty_iban_preserves_existing_iban(self):
        asyncio.run(
            self.http.AccountView().post(
                self._request(
                    {
                        "label": "Giro",
                        "bank": "Neue Bank",
                        "iban": "",
                        "owner_targets": [],
                        "active": True,
                    }
                ),
                "account-1",
            )
        )

        account = self.coordinator.store.data["accounts"][0]
        self.assertEqual(account["bank"], "Neue Bank")
        self.assertEqual(account["iban"], "AT123456789012345678")

    def test_post_rejects_iban_already_used_by_another_account_without_mutation(self):
        self.coordinator.store.data["accounts"].append(
            {
                "id": "account-2",
                "label": "Sparkonto",
                "iban": "DE89370400440532013000",
                "account_reference": "DE89370400440532013000",
                "owner_targets": [],
                "active": True,
            }
        )
        before = deepcopy(self.coordinator.store.data)

        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.AccountView().post(
                    self._request(
                        {
                            "label": "Giro geändert",
                            "bank": "Erste Bank",
                            "iban": "DE89 3704 0044 0532 0130 00",
                            "owner_targets": [],
                            "active": True,
                        }
                    ),
                    "account-1",
                )
            )

        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_changing_shared_account_owners_preserves_existing_booking_allocation(self):
        allocation_before = deepcopy(
            self.coordinator.store.data["bookings"][0]["allocations"]
        )

        asyncio.run(
            self.http.AccountView().post(
                self._request(
                    {
                        "label": "Gemeinsames Girokonto",
                        "owner_targets": ["person.alex", "household"],
                        "active": True,
                    }
                ),
                "account-1",
            )
        )

        booking = self.coordinator.store.data["bookings"][0]
        self.assertEqual(booking["allocations"], allocation_before)
        self.assertEqual(len(booking["allocations"]), 1)
        self.assertEqual(booking["allocations"][0]["target"], "household")
        self.assertEqual(booking["allocations"][0]["area"], "Hunde")

    def test_post_rejects_unknown_account_without_saving(self):
        before = deepcopy(self.coordinator.store.data)

        with self.assertRaises(self.not_found):
            asyncio.run(
                self.http.AccountView().post(
                    self._request(
                        {"label": "Giro", "owner_targets": [], "active": True}
                    ),
                    "missing",
                )
            )

        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_post_validates_live_targets_before_store_mutation(self):
        before = deepcopy(self.coordinator.store.data)

        with self.assertRaises(self.bad_request):
            asyncio.run(
                self.http.AccountView().post(
                    self._request(
                        {
                            "label": "Changed",
                            "owner_targets": ["person.removed"],
                            "active": False,
                        }
                    ),
                    "account-1",
                )
            )

        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)


class AccountViewRegistrationTests(unittest.TestCase):
    def test_async_setup_registers_authenticated_release_views(self):
        http, _, _, _ = _load_http_module()
        registered = []
        hass = types.SimpleNamespace(
            data={},
            http=types.SimpleNamespace(register_view=registered.append),
        )

        with patch.dict(sys.modules, {"custom_components.finanzplaner.http": http}):
            asyncio.run(finanzplaner.async_setup(hass, {}))

        release_views = (
            http.AccountsView,
            http.AccountView,
            http.ImportView,
            http.ExcelPreviewView,
            http.ExcelConfirmView,
            http.BookingAllocationsView,
        )
        for view in release_views:
            with self.subTest(view=view.__name__):
                self.assertIn(view, registered)
                self.assertIs(view.requires_auth, True)


if __name__ == "__main__":
    unittest.main()
