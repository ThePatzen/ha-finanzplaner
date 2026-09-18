import importlib
from copy import deepcopy
from decimal import Decimal
import unittest


def load_core():
    try:
        return importlib.import_module("custom_components.finanzplaner.core")
    except ModuleNotFoundError as exc:
        raise AssertionError(
            "The Finanzplaner core module must expose the tested domain behavior."
        ) from exc


class RuleMatchingTests(unittest.TestCase):
    def test_rule_matches_direction_counterparty_account_and_amount_range(self):
        result = load_core().rule_suggestion(
            {"account_id": "account-main", "amount": -42.50,
             "counterparty": "Supermarkt", "counterparty_account": "AT123",
             "purpose": "Einkauf", "direction": "expense"},
            [{"id": "r1", "label": "Einkauf", "active": True, "priority": 10,
              "account_id": "account-main", "counterparty": "Supermarkt",
              "counterparty_account": "AT123", "direction": "expense",
              "amount_min": 40, "amount_max": 50,
              "allocations": [{"target": "household", "share_percent": 100}]}],
            accounts={"account-main": {}}, valid_targets={"household"},
            catalogs={"areas": [], "categories": [], "projects": []}, pets={},
        )
        self.assertEqual(result["status"], "suggested")

    def test_exact_counterparty_and_account_create_one_suggestion(self):
        core = load_core()
        rules = [{
            "id": "rule-grocery",
            "label": "Supermarkt Haushalt",
            "active": True,
            "priority": 100,
            "account_id": "account-giro",
            "counterparty": "Supermarkt AG",
            "purpose_contains": None,
            "allocations": [{
                "target": "household",
                "share_percent": 100.0,
                "area_id": None,
                "category_id": "category-food",
                "project_id": None,
                "pet_id": None,
            }],
        }]
        booking = {
            "account_id": "account-giro",
            "counterparty": "  supermarkt ag ",
            "purpose": "Einkauf",
            "amount": -42.37,
        }

        result = core.rule_suggestion(
            booking,
            rules,
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household"},
            catalogs={
                "categories": [{"id": "category-food", "active": True}],
                "areas": [],
                "projects": [],
            },
            pets={},
        )

        self.assertEqual(result["status"], "suggested")
        self.assertEqual(result["suggestion"]["allocations"][0]["amount"], 42.37)

    def test_rule_without_counterparty_matches_by_account_and_purpose(self):
        core = load_core()
        rule = self._rule("rule-purpose-only", purpose_contains="POS")
        rule["counterparty"] = ""
        result = core.rule_suggestion(
            {
                "account_id": "account-giro",
                "counterparty": "",
                "purpose": "Sparenzu POS 166,90 AT K1",
                "amount": -0.10,
            },
            [rule],
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

        self.assertEqual(result["status"], "suggested")

    def test_rule_requires_at_least_one_matching_condition(self):
        core = load_core()
        rule = self._rule("rule-without-condition", account_id=None)
        rule["counterparty"] = ""
        rule["purpose_contains"] = None
        rule.pop("id")

        with self.assertRaisesRegex(ValueError, "mindestens eine Bedingung"):
            core.validate_rule_payload(
                rule,
                valid_targets={"household"},
                accounts={"account-giro": {"active": True}},
                catalogs={"categories": [], "areas": [], "projects": []},
                pets={},
            )

    def _rule(self, rule_id, *, priority=100, active=True,
              account_id="account-giro", purpose_contains=None,
              allocations=None):
        return {
            "id": rule_id,
            "label": rule_id,
            "active": active,
            "priority": priority,
            "account_id": account_id,
            "counterparty": "Supermarkt AG",
            "purpose_contains": purpose_contains,
            "allocations": allocations or [{
                "target": "household",
                "share_percent": 100.0,
                "area_id": None,
                "category_id": None,
                "project_id": None,
                "pet_id": None,
            }],
        }

    def _suggestion(self, rules, purpose="Einkauf", account_id="account-giro"):
        booking = {
            "account_id": account_id,
            "counterparty": "Supermarkt AG",
            "purpose": purpose,
            "amount": -42.37,
        }
        rules_before = deepcopy(rules)
        booking_before = deepcopy(booking)
        result = load_core().rule_suggestion(
            booking,
            rules,
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )
        self.assertEqual(rules, rules_before)
        self.assertEqual(booking, booking_before)
        return result

    def test_highest_priority_rule_wins(self):
        result = self._suggestion([
            self._rule("rule-low", priority=10),
            self._rule("rule-high", priority=20),
        ])

        self.assertEqual(result["status"], "suggested")
        self.assertEqual(result["suggestion"]["rule_id"], "rule-high")

    def test_long_booking_purpose_does_not_block_matching(self):
        for purpose_filter in (None, "monatlicher einkauf"):
            with self.subTest(purpose_filter=purpose_filter):
                result = self._suggestion(
                    [self._rule("rule-long", purpose_contains=purpose_filter)],
                    purpose="Details " * 1000 + " MONATLICHER   EINKAUF ",
                )
                self.assertEqual(result["status"], "suggested")

    def test_booking_counterparty_has_no_rule_payload_length_limit(self):
        for length in (120, 121, 160, 161, 1000):
            with self.subTest(length=length):
                rule = self._rule("rule-long-counterparty")
                rule["counterparty"] = "x" * min(length, 160)
                result = load_core().rule_suggestion(
                    {"account_id": "account-giro", "counterparty": "X" * length,
                     "purpose": "", "amount": -10},
                    [rule], accounts={"account-giro": {}}, valid_targets={"household"},
                    catalogs={}, pets={},
                )
                self.assertEqual(result["status"], "suggested" if length <= 160 else "unresolved")
                if length > 160:
                    self.assertIn("Keine aktive Regel", result["reason"])

    def test_invalid_winning_rules_block_fallback_and_explain_references(self):
        for field, value, reason in (
            ("target", "person.missing", "Person"),
            ("category_id", "missing-category", "Kategorie-ID"),
            ("area_id", "missing-area", "Bereichs-ID"),
            ("project_id", "missing-project", "Projekt-ID"),
            ("pet_id", "missing-pet", "Tier-ID"),
        ):
            for competing_priority in (10, 100):
                with self.subTest(field=field, competing_priority=competing_priority):
                    invalid = self._rule("rule-invalid", priority=100)
                    invalid["allocations"][0][field] = value
                    result = self._suggestion([
                        self._rule("rule-valid", priority=competing_priority), invalid,
                    ])
                    self.assertEqual(result["status"], "unresolved")
                    self.assertIsNone(result["suggestion"])
                    self.assertEqual(result["conflicts"], [])
                    self.assertIn("rule-invalid", result["reason"])
                    self.assertIn(reason, result["reason"])

    def test_all_invalid_top_rules_are_reported_in_stable_order(self):
        first, second = self._rule("rule-a"), self._rule("rule-b")
        first["allocations"][0]["pet_id"] = "missing-pet"
        second["allocations"][0]["category_id"] = "missing-category"
        result = self._suggestion([second, self._rule("rule-low", priority=10), first])
        self.assertEqual(result["status"], "unresolved")
        self.assertIsNone(result["suggestion"])
        self.assertIn("Tier-ID", result["reason"])
        self.assertIn("Kategorie-ID", result["reason"])
        self.assertLess(result["reason"].index("rule-a"), result["reason"].index("rule-b"))

    def test_invalid_lower_priority_or_nonmatching_rule_does_not_block_winner(self):
        invalid = self._rule("rule-invalid", priority=10)
        invalid["allocations"][0]["pet_id"] = "missing"
        for priority, counterparty in ((10, "Supermarkt AG"), (1000, "Other")):
            with self.subTest(priority=priority):
                invalid.update(priority=priority, counterparty=counterparty)
                result = self._suggestion([invalid, self._rule("rule-valid")])
                self.assertEqual(result["suggestion"]["rule_id"], "rule-valid")

    def test_reason_describes_only_the_conditions_used(self):
        for account_id in (None, "account-giro"):
            for purpose_filter in (None, "einkauf"):
                with self.subTest(account_id=account_id, purpose_filter=purpose_filter):
                    result = self._suggestion([self._rule(
                        "rule-reason", account_id=account_id, purpose_contains=purpose_filter,
                    )])
                    reason = result["suggestion"]["reason"]
                    self.assertIn("Supermarkt AG", reason)
                    if account_id is None:
                        self.assertIn("Alle Konten", reason)
                        self.assertNotIn("Giro", reason)
                    else:
                        self.assertIn("Giro", reason)
                        self.assertNotIn("Alle Konten", reason)
                    if purpose_filter:
                        self.assertIn("Verwendungszweck", reason)
                        self.assertIn(purpose_filter, reason)
                    else:
                        self.assertNotIn("Verwendungszweck", reason)

    def test_reason_does_not_claim_missing_counterparty_as_a_match(self):
        rule = self._rule("rule-account-purpose", purpose_contains="Einkauf")
        rule["counterparty"] = None

        result = self._suggestion([rule], purpose="Einkauf im Markt")

        reason = result["suggestion"]["reason"]
        self.assertNotIn("Zahlungsempfänger", reason)
        self.assertIn("Verwendungszweck", reason)

    def test_equal_highest_priority_rules_create_conflict(self):
        result = self._suggestion([
            self._rule("rule-a", priority=20),
            self._rule("rule-b", priority=20),
        ])

        self.assertEqual(result["status"], "conflict")
        self.assertEqual(result["conflicts"], ["rule-a", "rule-b"])

    def test_purpose_filter_rejects_nonmatching_booking(self):
        result = self._suggestion([
            self._rule("rule-purpose", purpose_contains="monat")
        ])

        self.assertEqual(result["status"], "unresolved")

    def test_disabled_rule_is_ignored(self):
        result = self._suggestion([
            self._rule("rule-disabled", active=False)
        ])

        self.assertEqual(result["status"], "unresolved")

    def test_account_mismatch_is_ignored(self):
        result = self._suggestion([
            self._rule("rule-other-account", account_id="account-other")
        ])

        self.assertEqual(result["status"], "unresolved")

    def test_percentage_materialization_assigns_rounding_remainder_to_first_row(self):
        core = load_core()
        allocations = [
            {"target": "household", "share_percent": 33.33,
             "area_id": None, "category_id": None, "project_id": None,
             "pet_id": None},
            {"target": "person.alex", "share_percent": 33.33,
             "area_id": None, "category_id": None, "project_id": None,
             "pet_id": None},
            {"target": "person.sam", "share_percent": 33.34,
             "area_id": None, "category_id": None, "project_id": None,
             "pet_id": None},
        ]
        result = core.rule_suggestion(
            {"account_id": "account-giro", "counterparty": "Supermarkt AG",
             "purpose": "Einkauf", "amount": -100.01},
            [self._rule("rule-split", allocations=allocations)],
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household", "person.alex", "person.sam"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

        amounts = [row["amount"] for row in result["suggestion"]["allocations"]]
        self.assertEqual(amounts, [33.34, 33.33, 33.34])
        self.assertEqual(
            sum((Decimal(str(amount)) for amount in amounts), Decimal("0.00")),
            Decimal("100.01"),
        )

    def test_rule_rejects_share_sum_other_than_one_hundred(self):
        core = load_core()
        rule = self._rule("rule-invalid")
        rule.pop("id")
        rule["allocations"][0]["share_percent"] = 99.99

        with self.assertRaises(ValueError):
            core.validate_rule_payload(
                rule,
                valid_targets={"household"},
                accounts={"account-giro": {"active": True}},
                catalogs={"categories": [], "areas": [], "projects": []},
                pets={},
            )

    def test_rule_rejects_unknown_target(self):
        core = load_core()
        rule = self._rule("rule-invalid")
        rule.pop("id")
        rule["allocations"][0]["target"] = "person.unknown"

        with self.assertRaises(ValueError):
            core.validate_rule_payload(
                rule,
                valid_targets={"household"},
                accounts={"account-giro": {"active": True}},
                catalogs={"categories": [], "areas": [], "projects": []},
                pets={},
            )

    def test_rule_rejects_archived_catalog(self):
        core = load_core()
        rule = self._rule("rule-archived")
        rule.pop("id")
        rule["allocations"][0]["category_id"] = "category-old"

        with self.assertRaises(ValueError):
            core.validate_rule_payload(
                rule,
                valid_targets={"household"},
                accounts={"account-giro": {"active": True}},
                catalogs={
                    "categories": [{"id": "category-old", "active": False}],
                    "areas": [],
                    "projects": [],
                },
                pets={},
            )

    def test_rule_payload_from_booking_preserves_allocation_metadata(self):
        core = load_core()
        payload = core.rule_payload_from_booking({
            "account_id": "account-giro",
            "counterparty": "Supermarkt AG",
            "allocations": [{
                "target": "household", "amount": 42.37,
                "area_id": "area-food", "category_id": "category-food",
                "project_id": None, "pet_id": None,
            }],
        })

        self.assertEqual(payload["account_id"], "account-giro")
        self.assertEqual(payload["allocations"][0]["category_id"], "category-food")
        self.assertEqual(sum(row["share_percent"] for row in payload["allocations"]), 100.0)

    def test_rule_payload_from_booking_allows_missing_counterparty(self):
        core = load_core()
        payload = core.rule_payload_from_booking({
            "account_id": "account-giro",
            "counterparty": "",
            "purpose": "Sparenzu POS 166,90 AT K1",
            "allocations": [{"target": "household", "amount": 0.10}],
        })

        self.assertIsNone(payload["counterparty"])
        self.assertEqual(payload["label"], "Sparenzu POS 166,90 AT K1")

    def test_zero_amount_booking_is_not_suggested(self):
        result = load_core().rule_suggestion(
            {
                "account_id": "account-giro",
                "counterparty": "Supermarkt AG",
                "purpose": "Einkauf",
                "amount": 0,
            },
            [self._rule("rule-zero")],
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

        self.assertEqual(result["status"], "unresolved")

    def test_too_small_booking_for_rule_rows_is_unresolved_without_invalid_amounts(self):
        allocations = [
            {
                "target": f"person.{name}",
                "share_percent": 25.0,
                "area_id": None,
                "category_id": None,
                "project_id": None,
                "pet_id": None,
            }
            for name in ("alex", "sam", "jules", "kim")
        ]
        result = load_core().rule_suggestion(
            {
                "account_id": "account-giro",
                "counterparty": "Supermarkt AG",
                "purpose": "Einkauf",
                "amount": -0.02,
            },
            [self._rule("rule-tiny", allocations=allocations)],
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"person.alex", "person.sam", "person.jules", "person.kim"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

        self.assertEqual(result["status"], "unresolved")
        self.assertIsNone(result["suggestion"])
        self.assertIn("positiv", result["reason"])

    def test_tiny_percentage_receives_one_positive_cent_when_possible(self):
        allocations = [
            {"target": "household", "share_percent": 99.99,
             "area_id": None, "category_id": None, "project_id": None,
             "pet_id": None},
            {"target": "person.alex", "share_percent": 0.01,
             "area_id": None, "category_id": None, "project_id": None,
             "pet_id": None},
        ]
        result = load_core().rule_suggestion(
            {
                "account_id": "account-giro",
                "counterparty": "Supermarkt AG",
                "purpose": "Einkauf",
                "amount": -1.00,
            },
            [self._rule("rule-tiny-share", allocations=allocations)],
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household", "person.alex"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

        amounts = [row["amount"] for row in result["suggestion"]["allocations"]]
        self.assertEqual(result["status"], "suggested")
        self.assertEqual(amounts, [0.99, 0.01])
        self.assertTrue(all(amount > 0 for amount in amounts))
        self.assertEqual(
            sum((Decimal(str(amount)) for amount in amounts), Decimal("0.00")),
            Decimal("1.00"),
        )

    def test_normalized_booking_account_matches_normalized_rule_account(self):
        result = self._suggestion(
            [self._rule("rule-account")], account_id="  account-giro  "
        )

        self.assertEqual(result["status"], "suggested")

    def test_malformed_booking_counterparty_returns_unresolved_projection(self):
        result = load_core().rule_suggestion(
            {
                "account_id": "account-giro",
                "counterparty": 42,
                "purpose": "Einkauf",
                "amount": -42.37,
            },
            [self._rule("rule-malformed-counterparty")],
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

        self.assertEqual(result["status"], "unresolved")
        self.assertIsNone(result["suggestion"])
        self.assertEqual(result["conflicts"], [])

    def test_malformed_booking_purpose_returns_unresolved_projection(self):
        result = load_core().rule_suggestion(
            {
                "account_id": "account-giro",
                "counterparty": "Supermarkt AG",
                "purpose": 42,
                "amount": -42.37,
            },
            [self._rule("rule-malformed-purpose", purpose_contains="einkauf")],
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

        self.assertEqual(result["status"], "unresolved")
        self.assertIsNone(result["suggestion"])
        self.assertEqual(result["conflicts"], [])
