---
name: ha-finanzplaner-verification
description: Use when selecting, running, or reporting verification for Finanzplaner changes, especially skill, backend, frontend, or release work.
---

# HA Finanzplaner Verification

Choose the smallest canonical entrypoint that covers the change, using [`docs/workflows/testing.md`](../../../docs/workflows/testing.md) as the source of truth:

| Change | Command |
| --- | --- |
| Markdown or skill-only | `scripts/check-fast` and `git diff --check` |
| One Python module/backend behavior | `scripts/test-file tests/<matching-file>.py` and `scripts/check-fast` |
| Frontend helper or panel behavior | `scripts/test-file custom_components/finanzplaner/frontend/panel-utils.test.mjs` and `node --check custom_components/finanzplaner/frontend/panel.js` |
| Storage, import, API, cross-cutting, or release preparation | `scripts/check-full` |

Use [`scripts/test-file`](../../../scripts/test-file), [`scripts/check-fast`](../../../scripts/check-fast), and [`scripts/check-full`](../../../scripts/check-full) rather than recreating their commands. If Node.js is missing, the scripts return status 2: report this as an environment limitation, not as a passed or failed frontend test. Distinguish a failing assertion, syntax error, or nonzero check from an unavailable dependency/runtime and include the command plus relevant output in the handoff.

Provide evidence before claiming completion: state the exact commands, their exit status, and any skipped checks or limitations. A clean documentation/skill check does not prove application behavior; do not generalize a focused result beyond its coverage.
