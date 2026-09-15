import asyncio
import importlib
import io
import sys
import types
import unittest
from copy import deepcopy
from unittest.mock import patch

from custom_components.finanzplaner.const import DOMAIN
from custom_components.finanzplaner.core import (
    booking_fingerprint,
    ensure_account,
)


class AccountDiscoveryTests(unittest.TestCase):
    def test_ensure_account_reuses_normalized_reference(self):
        data = {"accounts": []}

        first, created_first = ensure_account(
            data,
            " AT12 3456 7890 1234 5678 ",
            "AT123456789012345678",
        )
        second, created_second = ensure_account(data, "AT123456789012345678")

        self.assertTrue(created_first)
        self.assertFalse(created_second)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(first["iban"], "AT123456789012345678")
        self.assertEqual(first["owner_targets"], [])

    def test_mt940_reference_without_iban_is_stored_as_account_reference(self):
        data = {"accounts": []}

        account, created = ensure_account(data, "BANK-ACCOUNT-42")

        self.assertTrue(created)
        self.assertIsNone(account["iban"])
        self.assertEqual(account["account_reference"], "BANK-ACCOUNT-42")

    def test_iban_match_takes_priority_and_preserves_existing_account(self):
        existing = {
            "id": "existing-account",
            "label": "Haushaltskonto",
            "iban": "AT123456789012345678",
            "account_reference": "ORIGINAL-REFERENCE",
            "currency": "EUR",
            "owner_targets": ["person.alex"],
            "active": False,
            "created_at": "2026-09-01T08:00:00+00:00",
            "updated_at": "2026-09-01T08:00:00+00:00",
        }
        data = {"accounts": [existing]}

        account, created = ensure_account(
            data,
            "DIFFERENT-REFERENCE",
            " AT12 3456 7890 1234 5678 ",
        )

        self.assertFalse(created)
        self.assertIs(account, existing)
        self.assertEqual(account["id"], "existing-account")
        self.assertEqual(account["label"], "Haushaltskonto")
        self.assertEqual(account["account_reference"], "ORIGINAL-REFERENCE")
        self.assertEqual(account["owner_targets"], ["person.alex"])
        self.assertFalse(account["active"])

    def test_reference_match_can_fill_missing_iban_without_overwriting_metadata(self):
        existing = {
            "id": "reference-only-account",
            "label": "Bestehendes Konto",
            "iban": None,
            "account_reference": "BANK-ACCOUNT-42",
            "owner_targets": ["household"],
            "active": False,
        }
        data = {"accounts": [existing]}

        account, created = ensure_account(
            data,
            " bank-account-42 ",
            "AT123456789012345678",
        )

        self.assertFalse(created)
        self.assertIs(account, existing)
        self.assertEqual(account["iban"], "AT123456789012345678")
        self.assertEqual(account["label"], "Bestehendes Konto")
        self.assertEqual(account["owner_targets"], ["household"])
        self.assertFalse(account["active"])

    def test_distinct_references_without_shared_iban_are_not_merged(self):
        data = {"accounts": []}

        first, _ = ensure_account(data, "BANK-ACCOUNT-41")
        second, _ = ensure_account(data, "BANK-ACCOUNT-42")

        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(len(data["accounts"]), 2)


def _load_http_module():
    class FakeFileField:
        def __init__(self, filename, raw):
            self.filename = filename
            self.file = io.BytesIO(raw)

    class HTTPBadRequest(Exception):
        def __init__(self, *, text):
            super().__init__(text)
            self.text = text

    fake_web = types.ModuleType("aiohttp.web")
    fake_web.FileField = FakeFileField
    fake_web.HTTPBadRequest = HTTPBadRequest
    fake_web.HTTPNotFound = HTTPBadRequest
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
    return module, FakeCoordinator, FakeFileField, HTTPBadRequest


class BankImportViewTests(unittest.TestCase):
    def setUp(self):
        self.http, coordinator_type, self.file_field_type, self.bad_request = (
            _load_http_module()
        )

        class FakeStore:
            def __init__(self):
                self.data = {"accounts": [], "bookings": [], "imports": []}
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
        hass = types.SimpleNamespace(data={DOMAIN: {"entry": self.coordinator}})
        self.app = {"hass": hass}

    def _request(self, filename, raw):
        upload = self.file_field_type(filename, raw.encode("utf-8"))

        class Request:
            app = self.app

            async def post(self):
                return {"file": upload}

        return Request()

    def _import(self, filename, raw):
        return asyncio.run(self.http.ImportView().post(self._request(filename, raw)))

    def test_response_serializer_redacts_booking_accounts_without_mutating_store(self):
        booking = {
            "account": "AT12 3456 7890 1234 5678",
            "account_reference": "AT123456789012345678",
            "account_id": "account-1",
            "purpose": "Überweisung von AT12 3456 7890 1234 5678 für Hunde",
            "reference": "IBAN AT123456789012345678",
            "label": "Konto AT123456789012345678",
        }

        response = self.http._response_payload(
            {"last_unresolved": booking, "bookings": [booking], "booking": booking}
        )

        self.assertEqual(response["last_unresolved"]["account"], "…5678")
        self.assertEqual(response["bookings"][0]["account_reference"], "…5678")
        self.assertNotIn("AT123456789012345678", response["booking"]["purpose"])
        self.assertNotIn("AT123456789012345678", response["booking"]["reference"])
        self.assertNotIn("AT123456789012345678", response["booking"]["label"])
        self.assertEqual(booking["account"], "AT12 3456 7890 1234 5678")
        self.assertEqual(booking["account_reference"], "AT123456789012345678")

    def test_camt_import_discovers_account_and_links_booking(self):
        raw = """<?xml version="1.0" encoding="UTF-8"?>
        <Document><BkToCstmrStmt><Stmt>
          <Acct><Id><IBAN>AT12 3456 7890 1234 5678</IBAN></Id></Acct>
          <Ntry><Amt Ccy="EUR">12.50</Amt><CdtDbtInd>DBIT</CdtDbtInd>
            <BookgDt><Dt>2026-09-04</Dt></BookgDt>
            <NtryDtls><TxDtls><Refs><EndToEndId>REF-42</EndToEndId></Refs>
            <RmtInf><Ustrd>Testkauf</Ustrd></RmtInf></TxDtls></NtryDtls>
          </Ntry>
        </Stmt></BkToCstmrStmt></Document>"""

        result = self._import("statement.xml", raw)
        account = self.coordinator.store.data["accounts"][0]
        booking = self.coordinator.store.data["bookings"][0]

        self.assertEqual(result["new_accounts"], 1)
        self.assertEqual(result["unconfigured_accounts"], 1)
        self.assertNotIn("accounts", result)
        self.assertEqual(account["iban"], "AT123456789012345678")
        self.assertEqual(booking["account_id"], account["id"])
        self.assertEqual(booking["account_reference"], "AT123456789012345678")
        self.assertEqual(booking["id"], booking_fingerprint(self.http.parse_camt053(raw)[0]))
        self.assertEqual(booking["allocations"], [])
        self.assertEqual(booking["status"], "unresolved")
        self.assertNotIn("AT123456789012345678", str(result["preview"]))

    def test_mt940_import_discovers_reference_without_setting_targets(self):
        raw = (
            ":20:STATEMENT-42\n"
            ":25:BANK-ACCOUNT-42\n"
            ":61:2609020902D42,50NTRFNONREF\n"
            ":86:Testkauf\n"
        )

        result = self._import("statement.sta", raw)
        account = self.coordinator.store.data["accounts"][0]

        self.assertEqual(result["accepted"], 1)
        self.assertEqual(result["new_accounts"], 1)
        self.assertIsNone(account["iban"])
        self.assertEqual(account["account_reference"], "BANK-ACCOUNT-42")
        self.assertEqual(account["owner_targets"], [])

    def test_duplicate_import_keeps_fingerprint_and_does_not_rediscover_account(self):
        raw = (
            ":20:STATEMENT-42\n"
            ":25:BANK-ACCOUNT-42\n"
            ":61:2609020902D42,50NTRFNONREF\n"
            ":86:Testkauf\n"
        )

        first = self._import("statement.sta", raw)
        booking_id = self.coordinator.store.data["bookings"][0]["id"]
        second = self._import("statement.sta", raw)

        self.assertEqual(first["accepted"], 1)
        self.assertEqual(second["accepted"], 0)
        self.assertEqual(second["duplicates"], 1)
        self.assertEqual(second["new_accounts"], 0)
        self.assertEqual(second["unconfigured_accounts"], 0)
        self.assertEqual(len(self.coordinator.store.data["accounts"]), 1)
        self.assertEqual(len(self.coordinator.store.data["bookings"]), 1)
        self.assertEqual(self.coordinator.store.data["bookings"][0]["id"], booking_id)

    def test_import_deduplicates_spaced_and_compact_iban_forms(self):
        spaced = (
            "<?xml version=\"1.0\"?><Document><BkToCstmrStmt><Stmt>"
            "<Acct><Id><IBAN>AT12 3456 7890 1234 5678</IBAN></Id></Acct>"
            "<Ntry><Amt Ccy=\"EUR\">12.50</Amt><CdtDbtInd>DBIT</CdtDbtInd>"
            "<BookgDt><Dt>2026-09-04</Dt></BookgDt><NtryDtls><TxDtls>"
            "<Refs><EndToEndId>REF-42</EndToEndId></Refs><RmtInf><Ustrd>Testkauf</Ustrd></RmtInf>"
            "</TxDtls></NtryDtls></Ntry></Stmt></BkToCstmrStmt></Document>"
        )
        compact = spaced.replace("AT12 3456 7890 1234 5678", "AT123456789012345678")

        self.assertEqual(self._import("spaced.xml", spaced)["accepted"], 1)
        result = self._import("compact.xml", compact)

        self.assertEqual(result["accepted"], 0)
        self.assertEqual(result["duplicates"], 1)
        self.assertEqual(len(self.coordinator.store.data["bookings"]), 1)

    def test_parser_error_does_not_mutate_accounts_or_imports(self):
        before = deepcopy(self.coordinator.store.data)

        with self.assertRaises(self.bad_request):
            self._import("broken.xml", "<Document><broken>")

        self.assertEqual(self.coordinator.store.data, before)
        self.assertEqual(self.coordinator.store.save_count, 0)


if __name__ == "__main__":
    unittest.main()
