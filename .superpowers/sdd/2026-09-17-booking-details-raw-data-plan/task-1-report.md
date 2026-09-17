# Task 1 Report: Verlustfreie Parserdatensätze

## Implementation summary

- Added source_xml_node, a recursive XML representation preserving names, namespaces, attributes, text, tail text, and children.
- Added immutable ParsedBooking(booking, source_data) records.
- Added parse_mt940_records and parse_camt053_records.
- MT940 records preserve all lines from :61: through the line before the next :61:, including unknown tags and continuation lines. Context lines include pre-transaction and account-context lines. The record includes kind=mt940_transaction.
- CAMT.053 records preserve the complete Ntry tree and statement/account context.
- Existing parse_mt940 and parse_camt053 remain wrappers returning list[Booking].

## Files

- custom_components/finanzplaner/booking_source.py — new XML source representation.
- custom_components/finanzplaner/core.py — record type, record parsers, and compatible wrappers.
- tests/test_finanzplaner_core.py — MT940 and CAMT.053 losslessness tests.

## TDD RED evidence

Command:

    python3 -m unittest discover -s tests -p 'test_finanzplaner_core.py' -v

Output:

    Ran 20 tests in 0.016s
    FAILED (errors=2)

Expected failures:

    AttributeError: module 'custom_components.finanzplaner.core' has no attribute 'parse_camt053_records'
    AttributeError: module 'custom_components.finanzplaner.core' has no attribute 'parse_mt940_records'

The 18 pre-existing tests were successful; only the two new API tests errored because the additive APIs did not yet exist.

## TDD GREEN evidence

Focused command after implementation:

    python3 -m unittest discover -s tests -p 'test_finanzplaner_core.py' -v

Output:

    Ran 20 tests in 0.025s
    OK

Final focused verification after formatting/self-review:

    python3 -m unittest discover -s tests -p 'test_finanzplaner_core.py' -v

Output:

    Ran 20 tests in 0.030s
    OK

Full Python suite, run once before commit:

    python3 -m unittest discover -s tests -v

Output:

    Ran 182 tests in 0.123s
    OK

Additional check:

    git diff --check

Output:

    no output; exit status 0

## Self-review

- The public parser return types remain unchanged: both legacy functions return booking lists projected from ParsedBooking.
- Existing amount, date, direction, reference, purpose, counterparty, currency, fingerprint, and parser error behavior is retained.
- MT940 unknown tags and continuation lines are retained in input order.
- CAMT.053 source serialization is recursive and does not filter unknown nodes.
- The source data is booking-level and local; no original-file archive was introduced.
- Changes are limited to the requested parser module, core parser section, and focused tests.

## Concerns

- Git emitted existing line-ending warnings for the three committed files (LF will be replaced by CRLF); this did not affect tests or git diff --check.
- CAMT context stores the complete statement tree in addition to the complete entry tree, which is intentionally conservative for retaining relevant statement/account context.

## Commit

3d0c964 Preserve complete booking source records

## Fix round 1

### What changed

- MT940 parsing now keeps each original input line verbatim in
  source_data['record']['lines'], including leading and trailing whitespace.
  A separate stripped variable remains responsible for marker detection and
  normalized Booking fields.
- Added a focused regression test for source-line whitespace preservation.
- Strengthened the CAMT source test to assert record name, namespace, metadata,
  child structure, amount attributes/text, tail/text defaults, and the complete
  unknown nested node including its attribute and child value.

### Commands and outputs

RED verification:

    python3 -m unittest discover -s tests -p 'test_finanzplaner_core.py' -v

    Ran 21 tests in 0.017s
    FAILED (failures=1)

    AssertionError: Lists differ: [':61:2609020902D42,50NTRFNONREF', ':86:Hundefutter'] !=
    ['  :61:2609020902D42,50NTRFNONREF  ', ' :86:Hundefutter ']

GREEN focused parser verification:

    python3 -m unittest discover -s tests -p 'test_finanzplaner_core.py' -v

    Ran 21 tests in 0.028s
    OK

Full Python suite:

    python3 -m unittest discover -s tests -v

    Ran 183 tests in 0.118s
    OK

The fix was committed after these checks.
