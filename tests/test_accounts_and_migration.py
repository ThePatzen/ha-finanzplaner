import asyncio
import sys
import types
import unittest
from unittest.mock import patch

from custom_components.finanzplaner import core
from custom_components.finanzplaner.storage import FinanceStore, migrate_store_data


class AccountsAndMigrationTests(unittest.TestCase):
    def test_normalizes_iban_for_matching_without_changing_display_data(self):
        self.assertEqual(
            core.normalize_account_reference(" at12 3456 7890 1234 5678 "),
            "AT123456789012345678",
        )

    def test_migrates_old_bookings_to_one_stable_account(self):
        migrated = migrate_store_data(
            {
                "version": 1,
                "settings": {"household_name": "Testhaushalt"},
                "accounts": [],
                "plan_items": [],
                "bookings": [
                    {
                        "id": "booking-1",
                        "account": " AT12 3456 7890 1234 5678 ",
                        "allocations": [],
                    },
                    {
                        "id": "booking-2",
                        "account": "AT123456789012345678",
                        "allocations": [],
                    },
                ],
                "imports": [],
                "rules": [],
            },
            "Testhaushalt",
        )

        self.assertEqual(migrated["version"], 2)
        self.assertEqual(len(migrated["accounts"]), 1)
        self.assertEqual(
            migrated["bookings"][0]["account_id"],
            migrated["bookings"][1]["account_id"],
        )
        self.assertEqual(
            migrated["bookings"][0]["account_reference"],
            "AT123456789012345678",
        )
        self.assertEqual(migrated["accounts"][0]["owner_targets"], [])

    def test_migration_uses_existing_account_id_for_bookings(self):
        migrated = migrate_store_data(
            {
                "version": 1,
                "accounts": [
                    {
                        "id": "legacy-account",
                        "account_reference": " AT12 3456 7890 1234 5678 ",
                    }
                ],
                "bookings": [
                    {"id": "booking-1", "account": "AT123456789012345678"}
                ],
            },
            "Testhaushalt",
        )

        self.assertEqual(migrated["accounts"][0]["id"], "legacy-account")
        self.assertEqual(
            migrated["bookings"][0]["account_id"], "legacy-account"
        )

    def test_finance_store_forwards_legacy_version_to_store_migration_hook(self):
        legacy_data = {
            "version": 1,
            "accounts": [],
            "bookings": [],
        }

        class FakeStore:
            def __init__(self, hass, version, key):
                self.hass = hass
                self.version = version
                self.key = key

            async def async_load(self):
                return await self._async_migrate_func(1, 0, legacy_data)

            async def async_save(self, data):
                self.saved = data

        fake_storage = types.ModuleType("homeassistant.helpers.storage")
        fake_storage.Store = FakeStore
        fake_homeassistant = types.ModuleType("homeassistant")
        fake_helpers = types.ModuleType("homeassistant.helpers")

        with patch.dict(
            sys.modules,
            {
                "homeassistant": fake_homeassistant,
                "homeassistant.helpers": fake_helpers,
                "homeassistant.helpers.storage": fake_storage,
            },
        ):
            store = FinanceStore(object(), "Testhaushalt")
            loaded = asyncio.run(store.async_load())

        self.assertEqual(loaded["version"], 2)


if __name__ == "__main__":
    unittest.main()
