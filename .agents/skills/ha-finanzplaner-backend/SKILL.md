---
name: ha-finanzplaner-backend
description: Use when changing the Finanzplaner integration setup, config flow, coordinator, authenticated API views, sensors, binary sensors, or services.
---

# HA Finanzplaner Backend

Use this skill for changes to [`__init__.py`](../../../custom_components/finanzplaner/__init__.py), [`config_flow.py`](../../../custom_components/finanzplaner/config_flow.py), [`coordinator.py`](../../../custom_components/finanzplaner/coordinator.py), [`http.py`](../../../custom_components/finanzplaner/http.py), [`sensor.py`](../../../custom_components/finanzplaner/sensor.py), [`binary_sensor.py`](../../../custom_components/finanzplaner/binary_sensor.py), or [`services.py`](../../../custom_components/finanzplaner/services.py).

Read [`PRODUCT.md`](../../../PRODUCT.md), [`README.md`](../../../README.md), [`CHANGELOG.md`](../../../CHANGELOG.md), then [`docs/architecture.md`](../../../docs/architecture.md), [`docs/domain-invariants.md`](../../../docs/domain-invariants.md), and the relevant API view plus test module. Preserve Home Assistant authentication (`HomeAssistantView.requires_auth`), existing response projections and masking, and the established coordinator data flow. Do not invent a parallel API shape.

Choose focused Python tests from [`tests/test_account_payloads.py`](../../../tests/test_account_payloads.py), [`tests/test_account_import.py`](../../../tests/test_account_import.py), [`tests/test_plan_items.py`](../../../tests/test_plan_items.py), [`tests/test_rule_payloads.py`](../../../tests/test_rule_payloads.py), [`tests/test_reminders.py`](../../../tests/test_reminders.py), or the matching module. Run the focused test(s), then [`scripts/check-fast`](../../../scripts/check-fast).
