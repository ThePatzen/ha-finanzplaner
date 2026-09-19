---
name: ha-finanzplaner-frontend
description: Use when changing custom_components/finanzplaner/frontend/panel.js, panel-utils.mjs, their frontend tests, or panel behavior.
---

# HA Finanzplaner Frontend

Use this skill for [`panel.js`](../../../custom_components/finanzplaner/frontend/panel.js), [`panel-utils.mjs`](../../../custom_components/finanzplaner/frontend/panel-utils.mjs), and [`panel-utils.test.mjs`](../../../custom_components/finanzplaner/frontend/panel-utils.test.mjs).

Read [`PRODUCT.md`](../../../PRODUCT.md), [`README.md`](../../../README.md), [`CHANGELOG.md`](../../../CHANGELOG.md), then the affected frontend source and its tests together. Preserve authenticated Home Assistant requests and the existing API/data flow; do not replace live data with demo fallbacks.

Every UI change must preserve explicit loading, error, empty, and disabled states; semantic HTML; visible focus and keyboard access; usable touch targets; and responsive behavior. Keep the established German Fachsprache and Home Assistant embedding. Apply the project rule [`impeccable-project`](../impeccable-project/SKILL.md) and invoke `$impeccable` before frontend decisions or edits; it remains mandatory and is not replaced by this skill.

For focused checks, run [`scripts/test-file`](../../../scripts/test-file) with `custom_components/finanzplaner/frontend/panel-utils.test.mjs` and `node --check custom_components/finanzplaner/frontend/panel.js`. Finish with [`scripts/check-full`](../../../scripts/check-full) when panel behavior or cross-cutting frontend contracts change. If Node.js is unavailable, report the environment limitation and do not call the frontend check passed.
