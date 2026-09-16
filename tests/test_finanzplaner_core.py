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

    def test_custom_allocation_payload_is_cent_exact(self):
        core = load_core()

        allocations = core.parse_allocation_payload(
            [
                {"target": "person.alex", "amount": 33.34},
                {"target": "person.sam", "amount": 33.33},
                {
                    "target": "household",
                    "amount": 33.33,
                    "area": "Hunde",
                },
            ],
            -100.00,
            {"person.alex", "person.sam", "household"},
        )

        self.assertEqual([allocation.amount for allocation in allocations], [33.34, 33.33, 33.33])
        self.assertEqual(allocations[-1].target, "household")
        self.assertEqual(allocations[-1].area, "Hunde")


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

    def test_plan_items_are_scheduled_by_rhythm_and_due_date(self):
        core = load_core()
        quarterly = {
            "active": True,
            "direction": "income",
            "amount": 300,
            "remaining_amount": 300,
            "frequency_months": 3,
            "due_date": "2026-01-15",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        }

        self.assertEqual(core.plan_item_month_values(quarterly, "2026-02"), (100.0, 0.0))
        self.assertEqual(core.plan_item_month_values(quarterly, "2026-04"), (100.0, 300.0))

    def test_month_plan_respects_validity_and_one_time_dates(self):
        core = load_core()
        data = {
            "plan_items": [
                {
                    "active": True,
                    "direction": "expense",
                    "amount": 100,
                    "remaining_amount": 100,
                    "frequency_months": 1,
                    "due_day": 5,
                    "start_date": "2026-09-01",
                    "end_date": "2026-09-30",
                },
                {
                    "active": True,
                    "direction": "expense",
                    "amount": 250,
                    "remaining_amount": 250,
                    "frequency_months": None,
                    "due_date": "2026-10-10",
                },
            ],
            "bookings": [],
        }

        september = core.overview_values(data, "2026-09")
        october = core.overview_values(data, "2026-10")
        self.assertEqual(september["plan"], -100.0)
        self.assertEqual(september["forecast"], -100.0)
        self.assertEqual(october["plan"], -250.0)
        self.assertEqual(october["forecast"], -250.0)

    def test_overview_details_joins_plan_actual_and_unallocated_amounts(self):
        core = load_core()
        details = core.overview_details(
            {
                "catalogs": {
                    "areas": [{"id": "area-hunde", "label": "Hunde"}],
                    "categories": [{"id": "category-futter", "label": "Futter"}],
                },
                "plan_items": [
                    {
                        "active": True,
                        "direction": "expense",
                        "amount": 100,
                        "frequency_months": 1,
                        "due_day": 5,
                        "area": "alter Bereichsname",
                        "area_id": "area-hunde",
                        "category": "alte Kategorie",
                        "category_id": "category-futter",
                    }
                ],
                "bookings": [
                    {
                        "booking_date": "2026-09-03",
                        "amount": -30,
                        "status": "resolved",
                        "allocations": [
                            {
                                "amount": 30,
                                "area_id": "area-hunde",
                                "category_id": "category-futter",
                            }
                        ],
                    },
                    {
                        "booking_date": "2026-09-04",
                        "amount": -5,
                        "status": "unresolved",
                        "allocations": [],
                    },
                ],
            },
            "2026-09",
            today=date(2026, 9, 4),
        )

        self.assertEqual(details["areas"][0], {
            "name": "Hunde",
            "value": -30.0,
            "plan": -100.0,
            "actual": -30.0,
            "variance": 70.0,
        })
        self.assertEqual(details["categories"][0]["name"], "Futter")
        self.assertEqual(details["categories"][0]["plan"], -100.0)
        self.assertEqual(details["areas"][1]["name"], "Nicht zugeordnet")
        self.assertEqual(details["areas"][1]["actual"], -5.0)
        self.assertEqual(details["household"]["expenses"], -35.0)
        self.assertEqual(details["trend"]["planned"][-1], -100.0)
        self.assertEqual(details["trend"]["actual"][-1], -35.0)
        self.assertEqual(details["trend"]["forecast"][-1], -135.0)
        self.assertEqual(details["trend"]["today_index"], 3)


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
        self.assertEqual(bookings[0].account, "AT123456789012345678")
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
        self.assertEqual(bookings[0].account, "AT123456789012345678")
        self.assertEqual(bookings[0].amount, 125.00)
        self.assertEqual(bookings[0].counterparty, "Solarwerk")
        self.assertEqual(bookings[0].reference, "PAY-42")

    def test_camt053_uses_each_statement_account_and_ignores_counterparty_iban(self):
        core = load_core()
        raw = """<Document>
          <BkToCstmrStmt><Stmt><Acct><Id><IBAN>AT111111111111111111</IBAN></Id></Acct>
            <Ntry><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-09-04</Dt></BookgDt>
              <NtryDtls><TxDtls><RltdPties><DbtrAcct><Id><IBAN>AT999999999999999999</IBAN></Id></DbtrAcct></RltdPties><RmtInf><Ustrd>Erste</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
          </Stmt></BkToCstmrStmt>
          <BkToCstmrStmt><Stmt><Acct><Id><IBAN>AT222222222222222222</IBAN></Id></Acct>
            <Ntry><Amt Ccy="EUR">20.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-09-05</Dt></BookgDt><NtryDtls><TxDtls><RmtInf><Ustrd>Zweite</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
          </Stmt></BkToCstmrStmt>
          <BkToCstmrStmt><Stmt>
            <Ntry><Amt Ccy="EUR">30.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-09-06</Dt></BookgDt><NtryDtls><TxDtls><RltdPties><CdtrAcct><Id><IBAN>AT888888888888888888</IBAN></Id></CdtrAcct></RltdPties><RmtInf><Ustrd>Ohne eigenes Konto</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
          </Stmt></BkToCstmrStmt>
        </Document>"""

        bookings = core.parse_camt053(raw)

        self.assertEqual([booking.account for booking in bookings], [
            "AT111111111111111111", "AT222222222222222222", ""
        ])

    def test_mt940_closes_previous_booking_before_new_account_reference(self):
        core = load_core()
        raw = (
            ":25:FIRST-ACCOUNT\n"
            ":61:2609010901D10,00NTRFONE\n"
            ":25:SECOND-ACCOUNT\n"
            ":61:2609020902C20,00NTRFTWO\n"
        )

        bookings = core.parse_mt940(raw)

        self.assertEqual([booking.account for booking in bookings], ["FIRST-ACCOUNT", "SECOND-ACCOUNT"])

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

    def test_fingerprint_normalizes_formatted_account_references(self):
        core = load_core()
        fields = {
            "booking_date": date(2026, 9, 2),
            "amount": -42.50,
            "purpose": "Hundefutter",
            "reference": "NONREF",
        }

        self.assertEqual(
            core.booking_fingerprint(core.Booking(account="AT12 3456 7890 1234 5678", **fields)),
            core.booking_fingerprint(core.Booking(account="AT123456789012345678", **fields)),
        )


if __name__ == "__main__":
    unittest.main()
