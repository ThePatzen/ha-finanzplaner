---
name: ha-finanzplaner-storage
description: Use when changing FinanceStore persistence, schemas, normalization, migrations, historical snapshots, or account identity in the Finanzplaner.
---

# HA Finanzplaner Storage

Use this skill for [`storage.py`](../../../custom_components/finanzplaner/storage.py), storage schema changes, normalization, migration hooks, historical snapshots, or account identity and references. Read [`PRODUCT.md`](../../../PRODUCT.md), [`README.md`](../../../README.md), [`CHANGELOG.md`](../../../CHANGELOG.md), [`docs/architecture.md`](../../../docs/architecture.md), and especially [`docs/domain-invariants.md`](../../../docs/domain-invariants.md).

Work migration-first: identify the old and current payloads, preserve stable IDs across reload, retain historical snapshots and account links, and add regression coverage before changing the current schema. Never edit Home Assistant `.storage` files directly. Keep account owners distinct from booking targets and keep full account references local and masked at API boundaries.

Use [`tests/test_accounts_and_migration.py`](../../../tests/test_accounts_and_migration.py), [`tests/test_account_payloads.py`](../../../tests/test_account_payloads.py), [`tests/test_account_import.py`](../../../tests/test_account_import.py), and, where allocations are affected, [`tests/test_allocation_payloads.py`](../../../tests/test_allocation_payloads.py). Run the focused Python tests, then [`scripts/check-fast`](../../../scripts/check-fast); storage/API cross-cutting changes also require [`scripts/check-full`](../../../scripts/check-full).
