---
name: ha-finanzplaner-backend
description: Use when changing the Finanzplaner integration setup, config flow, coordinator, authenticated API views, sensors, binary sensors, or services.
---

# HA Finanzplaner Backend

Use this skill for changes to [`__init__.py`](../../../custom_components/finanzplaner/__init__.py), [`config_flow.py`](../../../custom_components/finanzplaner/config_flow.py), [`coordinator.py`](../../../custom_components/finanzplaner/coordinator.py), [`http.py`](../../../custom_components/finanzplaner/http.py), [`sensor.py`](../../../custom_components/finanzplaner/sensor.py), [`binary_sensor.py`](../../../custom_components/finanzplaner/binary_sensor.py), or [`services.py`](../../../custom_components/finanzplaner/services.py).

Read [`PRODUCT.md`](../../../PRODUCT.md), [`README.md`](../../../README.md), [`CHANGELOG.md`](../../../CHANGELOG.md), then [`docs/architecture.md`](../../../docs/architecture.md), [`docs/domain-invariants.md`](../../../docs/domain-invariants.md), and the relevant API view plus test module. Preserve Home Assistant authentication (`HomeAssistantView.requires_auth`), existing response projections and masking, and the established coordinator data flow. Do not invent a parallel API shape.

Use this source-to-test map; do not substitute a vague matching-module fallback:

| Source | Focused tests |
| --- | --- |
| [`__init__.py`](../../../custom_components/finanzplaner/__init__.py) | View registration: [`tests/test_account_payloads.py`](../../../tests/test_account_payloads.py), [`tests/test_allocation_payloads.py`](../../../tests/test_allocation_payloads.py), [`tests/test_overview_breakdown.py`](../../../tests/test_overview_breakdown.py), [`tests/test_plan_items.py`](../../../tests/test_plan_items.py), [`tests/test_pets.py`](../../../tests/test_pets.py), [`tests/test_rule_payloads.py`](../../../tests/test_rule_payloads.py) |
| [`config_flow.py`](../../../custom_components/finanzplaner/config_flow.py) | No dedicated test module currently exists. Run the full Python suite and add a focused test whenever behavior changes. |
| [`coordinator.py`](../../../custom_components/finanzplaner/coordinator.py) | No dedicated coordinator test module currently exists. [`tests/test_reminders.py`](../../../tests/test_reminders.py) uses fakes for consumer contracts, [`tests/test_account_import.py`](../../../tests/test_account_import.py) uses a `FakeCoordinator`, and [`tests/test_finanzplaner_core.py`](../../../tests/test_finanzplaner_core.py) covers core logic, not `coordinator.py`; run the full Python suite and add a focused coordinator test when behavior changes. |
| [`http.py`](../../../custom_components/finanzplaner/http.py) | [`tests/test_account_import.py`](../../../tests/test_account_import.py), [`tests/test_account_payloads.py`](../../../tests/test_account_payloads.py), [`tests/test_plan_items.py`](../../../tests/test_plan_items.py), [`tests/test_rule_payloads.py`](../../../tests/test_rule_payloads.py), [`tests/test_booking_history_reports.py`](../../../tests/test_booking_history_reports.py), and, for Excel views, [`tests/test_excel_api_payloads.py`](../../../tests/test_excel_api_payloads.py) |
| [`sensor.py`](../../../custom_components/finanzplaner/sensor.py), [`binary_sensor.py`](../../../custom_components/finanzplaner/binary_sensor.py), [`services.py`](../../../custom_components/finanzplaner/services.py) | [`tests/test_reminders.py`](../../../tests/test_reminders.py) |

Run the mapped focused Python tests; for `config_flow.py` behavior changes run the full Python suite and add the focused regression test. Then run [`scripts/check-fast`](../../../scripts/check-fast).
