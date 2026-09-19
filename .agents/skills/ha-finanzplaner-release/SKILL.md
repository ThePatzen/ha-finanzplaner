---
name: ha-finanzplaner-release
description: Use when preparing or executing an explicitly authorized Finanzplaner versioned HACS release.
---

# HA Finanzplaner Release

Follow [`docs/workflows/release.md`](../../../docs/workflows/release.md) exactly:

1. Confirm explicit release authorization.
2. Update `custom_components/finanzplaner/manifest.json` and [`CHANGELOG.md`](../../../CHANGELOG.md) to the same Semantic Version.
3. Run [`scripts/check-full`](../../../scripts/check-full) and `git diff --check`.
4. Confirm HACS structure and metadata, including [`hacs.json`](../../../hacs.json), the integration manifest, and the expected `custom_components/finanzplaner/` layout.
5. Only after successful verification create the local tag `vMAJOR.MINOR.PATCH`.
6. Use GitHub commands, pushes, and release publication only after explicit authorization and the required external approval.

Check that manifest version, changelog heading, and tag version match exactly. Keep release notes as real Markdown with headings, lists, and blank lines. The harness itself does not change versions. This skill never pushes or publishes by inference; if authorization is absent, stop after read-only checks and ask for it.
