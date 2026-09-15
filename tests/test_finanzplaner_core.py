import importlib
import unittest
from datetime import date


def load_core():
    try:
        return importlib.import_module("custom_components.finanzplaner.core")
    except ModuleNotFoundError as exc:
        raise AssertionError(
            "The Finanzplaner core module must expose the tested domain behavior."
        ) from exc


class AllocationRulesTests(unittest.TestCase):
    def test_shared_booking_can_be_split_between_people_and_hunde(self):
        core = load_core()
        allocations = [
            core.Allocation(target="person.alex", amount=50, area="Haushalt"),
            core.Allocation(target="person.sam", amount=30, area="Hunde"),
            core.Allocation(target="household", amount=20, area="Hunde"),
        ]

        self.assertEqual(core.validate_allocations(100, allocations), [])

    def test_incomplete_split_is_kept_for_review(self):
        core = load_core()
        allocations = [core.Allocation(target="person.alex", amount=90)]

        self.assertEqual(core.validate_allocations(100, allocations), ["amount_mismatch"])

    def test_split_amount_is_cent_exact_for_multiple_targets(self):
        core = load_core()

        allocations = core.split_amount(-100, ["person.alex", "person.sam", "household"])

        self.assertEqual([item.amount for item in allocations], [33.34, 33.33, 33.33])
        self.assertEqual(core.validate_allocations(-100, allocations), [])


class ForecastTests(unittest.TestCase):
    def test_signed_plan_amount_uses_direction_for_positive_imports(self):
        core = load_core()

        self.assertEqual(core.signed_plan_amount({"direction": "income", "amount": 100}), 100.0)
        self.assertEqual(core.signed_plan_amount({"direction": "expense", "amount": 100}), -100.0)
        self.assertEqual(core.signed_plan_amount({"direction": "saving", "amount": 100}), -100.0)
        self.assertEqual(core.signed_plan_amount({"amount": -100}), -100.0)

    def test_forecast_combines_planned_future_and_actuals(self):
        core = load_core()
        snapshot = core.month_snapshot(
            planned_total=4200,
            actual_total=3285.40,
            planned_remaining=913.60,
            unresolved_total=278.64,
        )

        self.assertEqual(snapshot.plan, 4200)
        self.assertEqual(snapshot.actual, 3285.40)
        self.assertEqual(snapshot.forecast, 4199.00)
        self.assertEqual(snapshot.variance, -1.00)
        self.assertTrue(snapshot.has_unresolved)

    def test_overview_values_feed_home_assistant_sensor_contract(self):
        core = load_core()
        overview = core.overview_values(
            {
                "plan_items": [
                    {"active": True, "amount": 120, "remaining_amount": 20},
                    {"active": False, "amount": 999, "remaining_amount": 999},
                ],
                "bookings": [
                    {"booking_date": "2026-09-03", "amount": -100, "status": "resolved"},
                    {"booking_date": "2026-09-10", "amount": -10, "status": "unresolved"},
                    {"booking_date": "2026-08-31", "amount": -500, "status": "resolved"},
                ],
            },
            "2026-09",
        )

        self.assertEqual(overview["planned_balance"], 120.0)
        self.assertEqual(overview["actual_balance"], -110.0)
        self.assertEqual(overview["unresolved_bookings"], 1)
        self.assertEqual(overview["unresolved_total"], 10.0)


class ImportTests(unittest.TestCase):
    def test_mt940_import_reads_booking_and_preserves_reference(self):
        core = load_core()
        raw = (
            ":20:STATEMENT-1\n"
            ":25:AT123456789012345678\n"
            ":60F:C260901EUR1000,00\n"
            ":61:2609020902D42,50NTRFNONREF\n"
            ":86:Hundefutter\n"
            ":62F:C260902EUR957,50\n"
        )

        bookings = core.parse_mt940(raw)

        self.assertEqual(len(bookings), 1)
        self.assertEqual(bookings[0].amount, -42.50)
        self.assertEqual(bookings[0].booking_date, date(2026, 9, 2))
        self.assertEqual(bookings[0].reference, "NONREF")
        self.assertEqual(bookings[0].purpose, "Hundefutter")

    def test_camt053_import_reads_amount_and_counterparty(self):
        core = load_core()
        raw = """<?xml version="1.0" encoding="UTF-8"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
          <BkToCstmrStmt><Stmt><Acct><Id><IBAN>AT123456789012345678</IBAN></Id></Acct>
            <Ntry><Amt Ccy="EUR">125.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
              <BookgDt><Dt>2026-09-04</Dt></BookgDt>
              <NtryDtls><TxDtls><Refs><EndToEndId>PAY-42</EndToEndId></Refs>
              <RltdPties><Cdtr><Nm>Solarwerk</Nm></Cdtr></RltdPties>
              <RmtInf><Ustrd>PV Erlös August</Ustrd></RmtInf></TxDtls></NtryDtls>
            </Ntry>
          </Stmt></BkToCstmrStmt>
        </Document>"""

        bookings = core.parse_camt053(raw)

        self.assertEqual(len(bookings), 1)
        self.assertEqual(bookings[0].amount, 125.00)
        self.assertEqual(bookings[0].counterparty, "Solarwerk")
        self.assertEqual(bookings[0].reference, "PAY-42")

    def test_fingerprint_is_stable_for_duplicate_imports(self):
        core = load_core()
        booking = core.Booking(
            account="AT123456789012345678",
            booking_date=date(2026, 9, 2),
            amount=-42.50,
            purpose="Hundefutter",
            reference="NONREF",
        )

        self.assertEqual(core.booking_fingerprint(booking), core.booking_fingerprint(booking))


if __name__ == "__main__":
    unittest.main()
