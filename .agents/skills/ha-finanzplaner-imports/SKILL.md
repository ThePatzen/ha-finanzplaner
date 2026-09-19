---
name: ha-finanzplaner-imports
description: Use when changing MT940 or CAMT parsing, booking source retention, Excel template imports, or their authenticated import API views.
---

# HA Finanzplaner Imports

Use this skill for parser changes in [`core.py`](../../../custom_components/finanzplaner/core.py), [`booking_source.py`](../../../custom_components/finanzplaner/booking_source.py), [`importers/excel_template.py`](../../../custom_components/finanzplaner/importers/excel_template.py), or import-related views in [`http.py`](../../../custom_components/finanzplaner/http.py), including `ImportView`, `ExcelPreviewView`, and `ExcelConfirmView`. Read [`PRODUCT.md`](../../../PRODUCT.md), [`README.md`](../../../README.md), [`CHANGELOG.md`](../../../CHANGELOG.md), [`docs/architecture.md`](../../../docs/architecture.md), and [`docs/domain-invariants.md`](../../../docs/domain-invariants.md).

Cover MT940 and CAMT.053 parsing, Excel preview and confirmation, duplicate detection, rejected imports without store mutation, masked responses, and lossless source-data retention using synthetic fixtures only. Do not use or copy real private bank or template files. Preserve source metadata and fingerprint behavior while keeping API payloads authenticated and masked.

Run the matching tests in [`tests/test_finanzplaner_core.py`](../../../tests/test_finanzplaner_core.py), [`tests/test_account_import.py`](../../../tests/test_account_import.py), [`tests/test_excel_template.py`](../../../tests/test_excel_template.py), and [`tests/test_excel_api_payloads.py`](../../../tests/test_excel_api_payloads.py), then [`scripts/check-fast`](../../../scripts/check-fast). Import/API cross-cutting changes also require [`scripts/check-full`](../../../scripts/check-full).
