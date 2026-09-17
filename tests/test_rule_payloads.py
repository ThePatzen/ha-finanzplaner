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
                            "source_data": {
                                "record": {"kind": "mt940_transaction"},
                            },
                        },
                        {
                            "id": "booking-unresolved",
                            "account_id": "account-1",
                            "counterparty": "Offene Buchung",
                            "amount": -15.0,
                            "status": "unresolved",
                            "allocations": [],
                            "source_data": {
                                "record": {"kind": "mt940_transaction"},
                            },
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

    def test_from_resolved_booking_allows_missing_counterparty(self):
        booking = next(
            item for item in self.coordinator.store.data["bookings"]
            if item["id"] == "booking-resolved"
        )
        booking["counterparty"] = ""
        booking["purpose"] = "Sparenzu POS 166,90 AT K1"

        result = asyncio.run(
            self.http.RuleFromBookingView().post(
                self._request({}),
                "booking-resolved",
            )
        )

        self.assertIsNone(result["rule"]["counterparty"])
        self.assertEqual(result["rule"]["label"], "Sparenzu POS 166,90 AT K1")

    def test_rules_get_masks_account_references(self):
        result = asyncio.run(self.http.RulesView().get(self._request()))

        account = result["rules"][0]["account"]
        self.assertEqual(account["label"], "Gemeinsames Girokonto")
        self.assertEqual(account["account_reference"], "…5678")
        self.assertEqual(account["iban_masked"], "•••• 5678")
        self.assertNotIn("AT123456789012345678", str(result))
        self.assertEqual(self.coordinator.store.save_count, 0)

    def test_opaque_id_collision_round_trips_get_update_and_deactivation(self):
        rule_id = "ab12cdef0123456789abcdef01234567"
        self.assertEqual(len(rule_id), 32)
        account_id = "account-cd34abcd01234567"
        self.coordinator.store.data["accounts"][0]["id"] = account_id
        payload = self._valid_rule_payload()
        payload["account_id"] = account_id
        with patch.object(self.http, "uuid4", return_value=types.SimpleNamespace(hex=rule_id)):
            created = asyncio.run(self.http.RulesView().post(self._request(payload)))
        self.assertEqual(created["rule"]["id"], rule_id)
        before = deepcopy(self.coordinator.store.data)
        result = asyncio.run(self.http.RulesView().get(self._request()))
        listed = result["rules"][-1]
        self.assertEqual(listed["id"], rule_id)
        self.assertEqual(listed["account_id"], account_id)
        self.assertEqual(listed["account"]["id"], account_id)
        self.assertNotIn("AT123456789012345678", str(result))
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 1)
        updated = asyncio.run(self.http.RuleView().post(
            self._request({"label": "Edited", "account_id": listed["account_id"]}), listed["id"],
        ))
        deactivated = asyncio.run(self.http.RuleView().post(
            self._request({"active": False}), updated["rule"]["id"],
        ))
        self.assertEqual(deactivated["rule"]["id"], rule_id)
        self.assertFalse(self.coordinator.store.data["rules"][-1]["active"])
        self.assertEqual(self.coordinator.store.save_count, 3)

    def test_redaction_preserves_only_validated_opaque_identifier_fields(self):
        opaque = "ab12cdef0123456789abcdef01234567"
        iban = "DE89370400440532013000"
        original = {
            "id": opaque, "suggestion": {"rule_id": opaque}, "conflicts": [opaque],
            "account_id": iban, "metadata": {"id": iban},
            "iban": opaque, "account": opaque, "account_reference": opaque,
            "note": opaque, "history": [iban, {"note": iban}],
        }
        before = deepcopy(original)
        result = self.http._response_payload(original)
        self.assertEqual(result["id"], opaque)
        self.assertEqual(result["suggestion"]["rule_id"], opaque)
        self.assertEqual(result["conflicts"], [opaque])
        self.assertNotIn(iban, str(result))
        for field in ("iban", "account", "account_reference", "note"):
            self.assertNotEqual(result[field], opaque)
        self.assertEqual(original, before)

    def test_rule_text_limits_at_boundaries(self):
        for field, limit in (("label", 120), ("counterparty", 160), ("purpose_contains", 160)):
            for length in (limit - 1, limit, limit + 1):
                with self.subTest(field=field, length=length):
                    payload = self._valid_rule_payload()
                    payload[field] = "x" * length
                    before = deepcopy(self.coordinator.store.data)
                    saves, refreshes = self.coordinator.store.save_count, self.coordinator.refresh_count
                    if length <= limit:
                        result = asyncio.run(self.http.RulesView().post(self._request(payload)))
                        self.assertEqual(result["rule"][field], "x" * length)
                    else:
                        with self.assertRaises(self.bad_request):
                            asyncio.run(self.http.RulesView().post(self._request(payload)))
                        self.assertEqual(self.coordinator.store.data, before)
                        self.assertEqual(self.coordinator.store.save_count, saves)
                        self.assertEqual(self.coordinator.refresh_count, refreshes)

    def test_priority_bounds_on_create_and_update(self):
        for priority in (-1, 1001, 1.5, True, "100", None, 0, 1000):
            for update in (False, True):
                with self.subTest(priority=priority, update=update):
                    payload = self._valid_rule_payload()
                    payload["priority"] = priority
                    before = deepcopy(self.coordinator.store.data)
                    saves, refreshes = self.coordinator.store.save_count, self.coordinator.refresh_count
                    request = self._request({"priority": priority} if update else payload)
                    call = self.http.RuleView().post(request, "rule-1") if update else self.http.RulesView().post(request)
                    if type(priority) is int and 0 <= priority <= 1000:
                        self.assertEqual(asyncio.run(call)["rule"]["priority"], priority)
                    else:
                        with self.assertRaises(self.bad_request):
                            asyncio.run(call)
                        self.assertEqual(self.coordinator.store.data, before)
                        self.assertEqual(self.coordinator.store.save_count, saves)
                        self.assertEqual(self.coordinator.refresh_count, refreshes)

    def test_percentages_reject_out_of_bounds_and_extra_precision_without_writes(self):
        for shares in ((0.001, 99.999), (0.009, 99.991), (0.011, 99.989), (99.999, 0.001),
                       (-0.01, 100.01), (0, 100),
                       (True, 99), (float("inf"), 0), (float("nan"), 100)):
            for update in (False, True):
                with self.subTest(shares=shares, update=update):
                    payload = self._valid_rule_payload()
                    payload["allocations"] = [
                        {"target": target, "share_percent": share}
                        for target, share in zip(("household", "person.alex"), shares)
                    ]
                    before = deepcopy(self.coordinator.store.data)
                    saves, refreshes = self.coordinator.store.save_count, self.coordinator.refresh_count
                    with self.assertRaises(self.bad_request):
                        if update:
                            asyncio.run(self.http.RuleView().post(self._request(payload), "rule-1"))
                        else:
                            asyncio.run(self.http.RulesView().post(self._request(payload)))
                    self.assertEqual(self.coordinator.store.data, before)
                    self.assertEqual(self.coordinator.store.save_count, saves)
                    self.assertEqual(self.coordinator.refresh_count, refreshes)

    def test_percentages_accept_hundredths_at_boundaries(self):
        for shares in ((0.01, 99.99), (33.33, 66.67), (100,)):
            with self.subTest(shares=shares):
                payload = self._valid_rule_payload()
                payload["allocations"] = [
                    {"target": target, "share_percent": share}
                    for target, share in zip(("household", "person.alex"), shares)
                ]
                result = asyncio.run(self.http.RulesView().post(self._request(payload)))
                self.assertEqual([row["share_percent"] for row in result["rule"]["allocations"]], list(shares))

    def test_corrected_booking_draft_is_validated_and_saved_without_changing_source(self):
        booking = self.coordinator.store.data["bookings"][0]
        booking["amount"] = -1000
        booking["account_id"] = "missing-account"
        booking["allocations"][0].update(amount=0.01, target="person.missing", pet_id="missing-pet")
        booking["allocations"][1]["amount"] = 999.99
        self.coordinator.store.data["catalogs"]["categories"][0]["active"] = False
        before = deepcopy(self.coordinator.store.data)
        with self.assertRaises(self.bad_request):
            asyncio.run(self.http.RuleFromBookingView().post(self._request({}), booking["id"]))
        draft = self.http.rule_payload_from_booking(booking)
        self.assertEqual(draft["allocations"][0]["share_percent"], 0)
        with self.assertRaises(self.bad_request):
            asyncio.run(self.http.RulesView().post(self._request(draft)))
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)
        draft["account_id"] = None
        draft["allocations"][0].update(
            target="household", share_percent=0.01, category_id=None, pet_id=None,
        )
        draft["allocations"][1]["share_percent"] = 99.99
        result = asyncio.run(self.http.RulesView().post(self._request(draft)))
        self.assertEqual(result["rule"]["allocations"][0]["share_percent"], 0.01)
        self.assertEqual(self.coordinator.store.data["bookings"], before["bookings"])
        self.assertEqual(self.coordinator.store.data["rules"][:-1], before["rules"])
        self.assertEqual(self.coordinator.store.save_count, 1)
        self.assertEqual(self.coordinator.refresh_count, 1)

    def test_rule_writes_and_projection_require_authentication_without_mutation(self):
        before = deepcopy(self.coordinator.store.data)
        calls = (
            self.http.RulesView().post(self._request(self._valid_rule_payload(), authenticated=False)),
            self.http.RuleView().post(self._request({"active": False}, authenticated=False), "rule-1"),
            self.http.RuleFromBookingView().post(self._request({}, authenticated=False), "booking-resolved"),
            self.http.BookingDeleteView().delete(self._request({"booking_ids": ["booking-resolved"]}, authenticated=False)),
            self.http.UnresolvedBookingsView().get(self._request(authenticated=False)),
        )
        for call in calls:
            with self.assertRaises(self.unauthorized):
                asyncio.run(call)
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_rules_get_does_not_repair_malformed_store(self):
        self.coordinator.store.data["rules"] = {"invalid": True}
        before = deepcopy(self.coordinator.store.data)

        result = asyncio.run(self.http.RulesView().get(self._request()))

        self.assertEqual(result["rules"], [])
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)


    def test_booking_details_expose_unresolved_context_and_source(self):
        result = asyncio.run(
            self.http.BookingDetailsView().get(
                self._request(authenticated=True), "booking-unresolved"
            )
        )

        self.assertEqual(result["booking"]["id"], "booking-unresolved")
        self.assertEqual(result["details"]["status"], "unresolved")
        self.assertIn("source_data", result)
        self.assertEqual(result["source_data"]["record"]["kind"], "mt940_transaction")
        self.assertEqual(result["account"]["label"], "Gemeinsames Girokonto")
        self.assertNotIn("AT123456789012345678", str(result))

    def test_booking_details_expose_resolved_allocations_and_rule(self):
        self.coordinator.store.data["bookings"][0]["matched_rule"] = {
            "rule_id": "rule-1",
            "rule_label": "Supermarkt Haushalt",
        }

        result = asyncio.run(
            self.http.BookingDetailsView().get(
                self._request(authenticated=True), "booking-resolved"
            )
        )

        self.assertEqual(result["details"]["status"], "resolved")
        self.assertEqual(result["details"]["allocations"][0]["target"], "household")
        self.assertEqual(result["details"]["matched_rule"]["rule_label"], "Supermarkt Haushalt")

    def test_booking_details_require_authentication(self):
        with self.assertRaises(self.unauthorized):
            asyncio.run(
                self.http.BookingDetailsView().get(
                    self._request(authenticated=False), "booking-unresolved"
                )
            )

    def test_booking_details_return_not_found_for_unknown_id(self):
        with self.assertRaises(self.not_found):
            asyncio.run(
                self.http.BookingDetailsView().get(
                    self._request(), "booking-missing"
                )
            )

    def test_booking_details_mark_legacy_booking_without_source(self):
        self.coordinator.store.data["bookings"] = [{
            "id": "legacy-booking",
            "status": "unresolved",
            "allocations": [],
        }]

        result = asyncio.run(
            self.http.BookingDetailsView().get(self._request(), "legacy-booking")
        )

        self.assertIn("source_data", result)
        self.assertIsNone(result["source_data"])

    def test_booking_lists_do_not_expose_source_data(self):
        unresolved = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))
        resolved = asyncio.run(self.http.ResolvedBookingsView().get(self._request()))

        self.assertNotIn("source_data", unresolved["bookings"][0])
        self.assertNotIn("source_data", resolved["bookings"][0])


class UnresolvedRuleProjectionTests(unittest.TestCase):
    setUp = RuleViewTests.setUp
    _request = RuleViewTests._request

    def test_unresolved_list_exposes_account_label_and_masked_reference(self):
        booking = {
            "id": "booking-account-display",
            "status": "unresolved",
            "account_id": "account-1",
            "account_reference": "AT123456789012345678",
            "counterparty": "Offene Buchung",
            "amount": -15.0,
            "allocations": [],
        }
        self.coordinator.store.data["bookings"] = [booking]

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        projected = body["bookings"][0]
        self.assertEqual(projected["account_label"], "Gemeinsames Girokonto")
        self.assertEqual(projected["account_reference"], "…5678")
        self.assertNotIn("AT123456789012345678", str(body))

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
        before = deepcopy(self.coordinator.store.data)

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        self.assertEqual(body["bookings"][0]["status"], "suggested")
        self.assertEqual(body["bookings"][0]["suggestion"]["rule_id"], "rule-1")
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)


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
        before = deepcopy(self.coordinator.store.data)

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        projected = body["bookings"][0]
        self.assertEqual(projected["status"], "conflict")
        self.assertEqual(set(projected["conflicts"]), {"rule-1", "rule-2"})
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

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
        before = deepcopy(self.coordinator.store.data)

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        projected = body["bookings"][0]
        self.assertEqual(projected["status"], "unresolved")
        self.assertIn("Kategorie-ID", projected["reason"])
        self.assertIn("Bestehende Regel", projected["reason"])
        self.assertIsNone(projected["suggestion"])
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_invalid_top_rule_does_not_fall_back_in_projection(self):
        rule = self.coordinator.store.data["rules"][0]
        fallback = deepcopy(rule)
        fallback.update(id="rule-fallback", priority=10)
        fallback["allocations"][0]["category_id"] = None
        self.coordinator.store.data["rules"].append(fallback)
        self.coordinator.store.data["catalogs"]["categories"][0]["active"] = False
        self.coordinator.store.data["bookings"][1]["counterparty"] = "Supermarkt"
        before = deepcopy(self.coordinator.store.data)
        result = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))
        projected = result["bookings"][0]
        self.assertEqual(projected["status"], "unresolved")
        self.assertIsNone(projected["suggestion"])
        self.assertIn("Kategorie-ID", projected["reason"])
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_projection_preserves_colliding_ids_and_redacts_matching_reason(self):
        rule = self.coordinator.store.data["rules"][0]
        rule["id"] = "ab12cdef0123456789abcdef01234567"
        account = self.coordinator.store.data["accounts"][0]
        account["id"] = "account-cd34abcd01234567"
        account["label"] = "Giro DE89370400440532013000"
        rule["account_id"] = account["id"]
        rule["purpose_contains"] = "DE89370400440532013000"
        booking = self.coordinator.store.data["bookings"][1]
        booking.update(account_id=account["id"], counterparty="Supermarkt", purpose="Details " * 100 + rule["purpose_contains"])
        before = deepcopy(self.coordinator.store.data)
        result = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))
        projected = result["bookings"][0]
        self.assertEqual(projected["account_id"], account["id"])
        self.assertEqual(projected["suggestion"]["rule_id"], rule["id"])
        self.assertIn("Verwendungszweck", projected["suggestion"]["reason"])
        self.assertIn("Giro", projected["suggestion"]["reason"])
        self.assertNotIn("DE89370400440532013000", str(result))
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

    def test_resolved_booking_is_not_returned_by_unresolved_view(self):
        self.coordinator.store.data["bookings"] = [{
            "id": "booking-resolved",
            "status": "resolved",
            "allocations": [],
        }]
        before = deepcopy(self.coordinator.store.data)

        body = asyncio.run(self.http.UnresolvedBookingsView().get(self._request()))

        self.assertEqual(body["bookings"], [])
        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)

class AutomaticRuleApplicationTests(unittest.TestCase):
    setUp = RuleViewTests.setUp
    _request = RuleViewTests._request

    def test_apply_rules_resolves_only_unique_matches_and_reports_conflicts(self):
        unique = {
            "id": "booking-unique",
            "status": "unresolved",
            "account_id": "account-1",
            "counterparty": "Supermarkt",
            "purpose": "Einkauf",
            "amount": -42.37,
            "allocations": [],
        }
        conflict = deepcopy(unique)
        conflict.update(id="booking-conflict", purpose="Konflikt")
        second_rule = deepcopy(self.coordinator.store.data["rules"][0])
        second_rule.update(id="rule-2", purpose_contains="Konflikt")
        self.coordinator.store.data["bookings"] = [unique, conflict]
        self.coordinator.store.data["rules"].append(second_rule)

        result = asyncio.run(
            self.http.ApplyRulesView().post(self._request({}))
        )

        self.assertEqual(result["applied"], 1)
        self.assertEqual(result["conflicts"], 1)
        self.assertEqual(result["unresolved"], 0)
        self.assertEqual(unique["status"], "resolved")
        self.assertEqual(unique["matched_rule"]["rule_id"], "rule-1")
        self.assertEqual(conflict["status"], "unresolved")
        self.assertEqual(conflict["allocations"], [])
        self.assertEqual(self.coordinator.store.save_count, 1)

    def test_resolved_view_lists_manual_and_rule_resolved_bookings(self):
        resolved = self.coordinator.store.data["bookings"][0]
        resolved["matched_rule"] = {
            "rule_id": "rule-1",
            "rule_label": "Bestehende Regel",
            "reason": "Konto und Zahlungsempfänger stimmen überein.",
            "applied_at": "2026-09-17T10:00:00+00:00",
        }

        result = asyncio.run(
            self.http.ResolvedBookingsView().get(self._request())
        )

        self.assertEqual([booking["id"] for booking in result["bookings"]], ["booking-resolved"])
        self.assertEqual(result["bookings"][0]["matched_rule"]["rule_id"], "rule-1")
        self.assertEqual(self.coordinator.store.save_count, 0)

    def test_unresolve_returns_booking_to_review_and_clears_rule_metadata(self):
        booking = self.coordinator.store.data["bookings"][0]
        booking["matched_rule"] = {
            "rule_id": "rule-1",
            "rule_label": "Bestehende Regel",
            "reason": "Treffer",
            "applied_at": "2026-09-17T10:00:00+00:00",
        }
        before_refreshes = self.coordinator.refresh_count

        result = asyncio.run(
            self.http.BookingUnresolveView().post(
                self._request({}),
                "booking-resolved",
            )
        )

        self.assertEqual(result["booking"]["status"], "unresolved")
        self.assertEqual(booking["allocations"], [])
        self.assertIsNone(booking["matched_rule"])
        self.assertEqual(self.coordinator.store.save_count, 1)
        self.assertEqual(self.coordinator.refresh_count, before_refreshes + 1)

    def test_delete_removes_selected_bookings_and_refreshes_data(self):
        result = asyncio.run(
            self.http.BookingDeleteView().delete(
                self._request({"booking_ids": ["booking-resolved", "booking-unresolved"]})
            )
        )

        self.assertEqual(result["deleted"], 2)
        self.assertEqual(self.coordinator.store.data["bookings"], [])
        self.assertEqual(self.coordinator.store.save_count, 1)
        self.assertEqual(self.coordinator.refresh_count, 1)

    def test_delete_rejects_unknown_booking_without_mutating_store(self):
        before = deepcopy(self.coordinator.store.data)

        with self.assertRaises(self.not_found):
            asyncio.run(
                self.http.BookingDeleteView().delete(
                    self._request({"booking_ids": ["booking-missing"]})
                )
            )

        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)
        self.assertEqual(self.coordinator.refresh_count, 0)


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

        for view in (
            http.RulesView,
            http.RuleView,
            http.RuleFromBookingView,
            http.BookingDetailsView,
            http.BookingDeleteView,
        ):
            with self.subTest(view=view.__name__):
                self.assertIn(view, registered)
                self.assertIs(view.requires_auth, True)


if __name__ == "__main__":
    unittest.main()
