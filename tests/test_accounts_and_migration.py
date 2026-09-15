import unittest

from custom_components.finanzplaner import core
from custom_components.finanzplaner.storage import migrate_store_data


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


if __name__ == "__main__":
    unittest.main()
