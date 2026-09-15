# Excel-Migration und HA-Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the existing Finanzplan workbook into reviewable structured plan items and make the panel's Home Assistant brand link return to the normal HA menu under any configured URL base path.

**Architecture:** A dependency-free XLSX reader reads workbook XML, shared strings, cached values, and formulas. A normalization layer converts the relevant sheets into immutable suggestions with source metadata and warnings; HTTP keeps only an in-memory preview until explicit confirmation persists selected suggestions. The native panel uses pure URL utilities for HA navigation and displays the Excel review wizard.

**Tech Stack:** Python 3.13 standard library (`zipfile`, `xml.etree.ElementTree`, `decimal`, `dataclasses`), Home Assistant `HomeAssistantView` and `Store`, native Web Component JavaScript, Node test runner, Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-09-15-excel-migration-design.md`

## Global Constraints

- No `openpyxl` or other new runtime dependency.
- Original workbook files are read locally and never persisted.
- `Übersicht` formulas and summary rows are never imported as plan items.
- Formula cache values may be previewed, but imported formulas produce `formula_value` warnings.
- Historical Urlaubsgeld columns `E`/`F` are report-only.
- Stored plan-item amounts are positive; `direction` is `income`, `expense`, or `saving`.
- `Hunde` is one shared area; no individual dog entities are created.
- The `Home Assistant` link returns to the HA base route and removes query/hash state.
- Every task ends with a focused test run and a local Git commit.

---

### Task 1: Add base-path-safe Home Assistant navigation

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel-utils.mjs`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.test.mjs`
- Modify: `custom_components/finanzplaner/frontend/panel.js`

**Interfaces:**
- Consumes: current browser URL and panel path `/finanzplaner`.
- Produces: `homeAssistantPath(currentHref, panelPath = "/finanzplaner") -> string`, returning only the HA base pathname.

- [ ] **Step 1: Write failing tests**

```js
test("returns from a root-hosted panel to the HA base route", () => {
  assert.equal(
    utils.homeAssistantPath("https://ha.example/finanzplaner?view=review#booking"),
    "/",
  );
});

test("preserves an installation base path but removes panel state", () => {
  assert.equal(
    utils.homeAssistantPath("https://ha.example/homeassistant/finanzplaner/?view=review#booking"),
    "/homeassistant/",
  );
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs`.
Expected: the two new tests fail because `homeAssistantPath` is not exported.

- [ ] **Step 3: Implement the helper and wire the shared shell**

Add and export:

```js
export function homeAssistantPath(currentHref, panelPath = "/finanzplaner") {
  const url = new URL(currentHref);
  const normalizedPanel = `/${panelPath.replace(/^\/+|\/+$/g, "")}`;
  const panelPattern = new RegExp(`${normalizedPanel}/?$`);
  return url.pathname.replace(panelPattern, "/") || "/";
}
```

Import it in `panel.js` and change the rail brand to
`href="${homeAssistantPath(window.location.href)}"`. Keep the visible text,
accessible label, and shared shell in both overview and review views.

- [ ] **Step 4: Run tests and commit**

Run `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs`
and `node --check custom_components/finanzplaner/frontend/panel.js`; both must
exit successfully.

```bash
git add custom_components/finanzplaner/frontend/panel-utils.mjs \
  custom_components/finanzplaner/frontend/panel-utils.test.mjs \
  custom_components/finanzplaner/frontend/panel.js
git commit -m "feat: return from panel to home assistant menu"
```

### Task 2: Build the dependency-free XLSX reader

**Files:**
- Create: `custom_components/finanzplaner/importers/__init__.py`
- Create: `custom_components/finanzplaner/importers/excel_template.py`
- Create: `tests/test_excel_template.py`

**Interfaces:**
- Consumes: XLSX bytes from a local upload.
- Produces: `read_xlsx(raw: bytes) -> Workbook` with `Workbook.sheets: dict[str, Sheet]`, `Sheet.rows: tuple[dict[str, Cell], ...]`, and `Cell(value: str | Decimal | None, formula: str | None)`.
- Produces: `XlsxImportError` with stable German messages for invalid ZIP/XML and unresolved worksheets.

- [ ] **Step 1: Write an in-memory anonymized fixture test**

Build the fixture inside the test with `zipfile.ZipFile`; include workbook
relationships, shared strings, and one `Einnahmen` worksheet containing
`A1=Kategorie`, `B1=Bezeichnung`, `C1=1 Monat`, `G1=12 Monat`,
`K1=Wert heruntergebrochen pro Monat`, `L1=Pro Jahr`. Include a data row with
a shared-string name, a numeric value, and a formula with cached value.

```python
def test_reads_shared_strings_cached_values_and_formulas(self):
    workbook = read_xlsx(build_fixture_xlsx())
    row = workbook.sheets["Einnahmen"].rows[1]
    self.assertEqual(row["A"].value, "Einkommen")
    self.assertEqual(row["B"].value, "Gehalt Alex")
    self.assertEqual(row["C"].value, Decimal("3200.00"))
    self.assertEqual(row["K"].value, Decimal("3200.00"))
    self.assertEqual(row["K"].formula, "C2+D2/2")
```

- [ ] **Step 2: Run the test and verify the red state**

Run `python3 -m unittest tests.test_excel_template -v`.
Expected: import failure because `excel_template` does not exist.

- [ ] **Step 3: Implement XML workbook reading**

Open the XLSX as `ZipFile`, resolve worksheet targets through
`xl/_rels/workbook.xml.rels`, parse `xl/sharedStrings.xml` once, resolve
`t="s"` and `t="inlineStr"`, convert numeric `<v>` values to `Decimal`, and
capture `<f>` text alongside its cached `<v>`. Store rows by column letters and
omit completely empty cells.

- [ ] **Step 4: Implement safe parse errors**

Raise `XlsxImportError("Die Datei ist kein gültiges XLSX-Archiv.")` for invalid
ZIP data, `XlsxImportError("Die XLSX-Arbeitsmappe konnte nicht gelesen werden.")`
for malformed XML, and
`XlsxImportError("Die XLSX-Arbeitsmappe enthält keine Arbeitsblätter.")` if no
sheet resolves. Do not include file contents or local paths in errors.

- [ ] **Step 5: Run and commit**

Run `python3 -m unittest tests.test_excel_template -v` and then:

```bash
git add custom_components/finanzplaner/importers tests/test_excel_template.py
git commit -m "feat: read finance plan xlsx cells and formulas"
```

### Task 3: Normalize template sheets into suggestions

**Files:**
- Modify: `custom_components/finanzplaner/importers/excel_template.py`
- Modify: `custom_components/finanzplaner/core.py`
- Modify: `tests/test_excel_template.py`
- Modify: `tests/test_finanzplaner_core.py`

**Interfaces:**
- Consumes: `Workbook` from Task 2.
- Produces: frozen `PlanItemSuggestion` with `id`, `direction`, `name`, `category`, `area`, `project`, `amount`, `frequency_months`, `normalized_monthly`, `annual_amount`, `person_hint`, `source_sheet`, `source_row`, `source_columns`, `source_formula`, and `warnings`.
- Produces: frozen `ExcelWarning(code, message, sheet, row)` and `ExcelImportPreview(preview_id, suggestions, warnings, skipped_rows, historical_rows)`.
- Produces: `preview_template(raw: bytes, preview_id: str) -> ExcelImportPreview`.

- [ ] **Step 1: Write normalization tests**

Use an anonymized fixture containing the three main sheets, `Urlaubsgelder`, and
`EMX Calc`:

```python
def test_normalizes_main_sheets_and_hunde_area(self):
    preview = preview_template(build_template_fixture_xlsx(), "preview-1")
    names = {(item.source_sheet, item.name, item.frequency_months) for item in preview.suggestions}
    self.assertIn(("Einnahmen", "Gehalt Alex", 1), names)
    self.assertIn(("Ausgaben", "Hundefutter", 1), names)
    self.assertIn(("Sparen  und Rücklagen", "Rücklagen", 1), names)
    hunde = next(item for item in preview.suggestions if item.name == "Hundefutter")
    self.assertEqual(hunde.area, "Hunde")
    self.assertEqual(hunde.direction, "expense")

def test_formula_and_historical_values_are_warnings(self):
    preview = preview_template(build_template_fixture_xlsx(), "preview-2")
    codes = {warning.code for warning in preview.warnings}
    self.assertIn("formula_value", codes)
    self.assertIn("historical_value", codes)
    self.assertEqual(sum(item.name == "Summe" for item in preview.suggestions), 0)
```

- [ ] **Step 2: Run the tests and verify the red state**

Run `python3 -m unittest tests.test_excel_template -v`.
Expected: failures because the suggestion dataclasses and `preview_template`
are not implemented.

- [ ] **Step 3: Implement the suggestion model and stable IDs**

Define frozen, slotted dataclasses. Generate IDs as SHA-256 over sheet, row,
rhythm column, direction, name, and amount so repeated rows in one preview do
not collide. Keep `Decimal` internally and convert only at the HTTP boundary.

- [ ] **Step 4: Normalize the three main sheets**

Map `Einnahmen` to `income`, `Ausgaben` to `expense`, and `Sparen  und
Rücklagen` to `saving`. Read `A`, `B`, `C:G`, `K`, and `L`; create one item per
nonzero rhythm cell using frequencies `1, 2, 3, 6, 12`. Copy `K/L` into
normalized monthly/annual fields. Map `Hundefutter` and `Hundesteuer` to
`Hunde`. Map `Gehalt <Name>` to category `Gehalt` and `person_hint=<Name>`.
Add `signed_plan_amount(item)` in `core.py`: income returns `+amount`, expense
and saving return `-amount`, and legacy items without `direction` retain their
existing signed `amount`. Use this helper for both `plan` and
`planned_remaining` in `overview_values`, so imported positive expense values
do not inflate the household balance.

- [ ] **Step 5: Normalize Urlaubsgelder and EMX**

Use current `Urlaubsgelder` columns `B/C` and their headers as person hints;
create annual income items for Sommer/Winter and report `E/F` as historical.
Read only the named left `EMX Calc` table `B:D`; create monthly expense items
with `project="EMX"`, `amount=C`, `frequency_months=1`, and `annual_amount=D`.
Ignore summary/comparison rows and add `comparison_table_diff` when the right
table differs. Add `formula_value` for formula amount cells and
`derived_column` for cached K/L/I/J fields.

- [ ] **Step 6: Enforce required sheets and skip rules**

Require `Einnahmen`, `Ausgaben`, and `Sparen  und Rücklagen`; raise
`XlsxImportError` listing missing sheet names. Treat `Übersicht` as report-only.
Count blank, total, and calculation-only rows in `skipped_rows` and attach the
specified warning codes.

- [ ] **Step 7: Run and commit**

Run `python3 -m unittest discover -s tests -v`; all existing and new tests must
pass.

```bash
git add custom_components/finanzplaner/importers/excel_template.py \
  custom_components/finanzplaner/core.py tests/test_excel_template.py \
  tests/test_finanzplaner_core.py
git commit -m "feat: normalize finance plan workbook suggestions"
```

### Task 4: Add preview and confirmation APIs

**Files:**
- Modify: `custom_components/finanzplaner/coordinator.py`
- Modify: `custom_components/finanzplaner/http.py`
- Modify: `custom_components/finanzplaner/__init__.py`
- Modify: `custom_components/finanzplaner/storage.py`
- Create: `tests/test_excel_api_payloads.py`

**Interfaces:**
- Produces: `POST /api/finanzplaner/excel/preview` with multipart `file`, returning `preview_id`, suggestions, warnings, skipped count, and historical count.
- Produces: `POST /api/finanzplaner/excel/confirm` with `{preview_id, selected_ids, overrides}`, returning accepted/skipped counts.
- Produces: `preview_payload(preview: ExcelImportPreview) -> dict[str, object]` and `confirm_suggestions(preview, selected_ids, overrides) -> tuple[list[dict[str, object]], int]` as dependency-free helpers for the HTTP views.
- Persists selected positive-amount plan items with import ID and source metadata; never persists raw bytes.

- [ ] **Step 1: Write pure payload tests**

Test `preview_payload(preview)` includes `preview_id`, suggestions, and warnings
but not `raw` or `file_bytes`. Test confirmation rejects unknown suggestion IDs,
accepts selected IDs, allows overrides only for `direction`, `category`,
`area`, `project`, and `person_hint`, and preserves source sheet/row.
Test `signed_plan_amount` with `income=100`, `expense=100`, and `saving=100`
and verify the existing legacy signed-amount behavior remains unchanged.

- [ ] **Step 2: Run the tests and verify the red state**

Run `python3 -m unittest tests.test_excel_api_payloads -v`.
Expected: failures because the new payload helpers do not exist.

- [ ] **Step 3: Add transient preview storage**

Add `pending_excel_previews: dict[str, ExcelImportPreview]` to the coordinator.
Keep it out of `FinanceStore`; restart or cancellation must remove the uploaded
workbook without leaving it in persistent storage.

- [ ] **Step 4: Implement `ExcelPreviewView`**

Require authentication, accept only `.xlsx`, cap the in-memory upload at 10 MiB,
create a UUID, call `preview_template`, retain the object in the coordinator,
and return the JSON payload. Return HTTP 400 for missing file, wrong extension,
oversized upload, or `XlsxImportError`; do not log paths or contents.

- [ ] **Step 5: Implement `ExcelConfirmView`**

Require authentication, resolve the preview, reject unknown IDs, apply only the
allowed overrides, append selected dictionaries to `store.data["plan_items"]`,
append an import report with counts/source metadata, save, refresh, and remove
the preview. Validation failure must not save or remove it.

- [ ] **Step 6: Run and commit**

Run `python3 -m unittest discover -s tests -v` and
`python3 -m compileall -q custom_components`; both must exit successfully.

```bash
git add custom_components/finanzplaner/coordinator.py \
  custom_components/finanzplaner/http.py custom_components/finanzplaner/__init__.py \
  custom_components/finanzplaner/storage.py tests/test_excel_api_payloads.py
git commit -m "feat: add reviewable excel import api"
```

### Task 5: Add the Excel review wizard to the native panel

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel.js`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.mjs`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.test.mjs`

**Interfaces:**
- Consumes: both Excel API endpoints from Task 4.
- Produces: selectable suggestions, editable direction/category/area/project fields, warning summary, historical count, explicit confirmation, and cancellation without persistence.
- Preserves: existing MT940/CAMT.053 import and unresolved-booking flow.

- [ ] **Step 1: Write the selection summary test**

```js
test("summarizes selected excel suggestions", () => {
  assert.deepEqual(
    utils.selectedSuggestionSummary([
      { selected: true, amount: 12.5 },
      { selected: false, amount: 9 },
      { selected: true, amount: 2.5 },
    ]),
    { count: 2, amount: 15 },
  );
});
```

- [ ] **Step 2: Run the utility test and verify the red state**

Run `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs`.
Expected: the new test fails because `selectedSuggestionSummary` is not exported.

- [ ] **Step 3: Implement preview state and upload routing**

Add `_excelPreview`. Include `.xlsx` in the file input. Route `.xlsx` to
`/api/finanzplaner/excel/preview`; keep MT940/CAMT.053 on the existing endpoint.

- [ ] **Step 4: Render accessible suggestion controls**

Render checkbox, source sheet/row, name, amount, direction, category, area
select including `Hunde`, project, formula/historical warning badges, selected
count, and selected total. Use native labels, focus-visible controls, and
`aria-live` status text.

- [ ] **Step 5: Implement confirm/discard actions**

Send `{preview_id, selected_ids, overrides}` only after `Planposten übernehmen`.
On success clear preview state, refresh overview, and report accepted/skipped
counts. `Vorschau verwerfen` clears client state without a write request.

- [ ] **Step 6: Run and commit**

Run the Node utility tests and `node --check custom_components/finanzplaner/frontend/panel.js`.

```bash
git add custom_components/finanzplaner/frontend/panel.js \
  custom_components/finanzplaner/frontend/panel-utils.mjs \
  custom_components/finanzplaner/frontend/panel-utils.test.mjs
git commit -m "feat: add excel import review wizard"
```

### Task 6: Document the migration and run the release gate

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Produces: documented local migration flow, complete test commands, and CI validation for Python compilation and JSON metadata.

- [ ] **Step 1: Document the user flow**

Document: open Finanzplaner → `Buchungen prüfen` → choose `.xlsx` → review
warnings/selections → confirm. State that `Übersicht` is not imported and the
original workbook is not stored.

- [ ] **Step 2: Add release notes and CI checks**

Document formula warnings, historical Urlaubsgeld handling, EMX mapping, and
the HA menu link. Add these CI steps:

```yaml
- name: Compile integration Python
  run: python -m compileall -q custom_components
- name: Validate JSON metadata
  run: python -m json.tool custom_components/finanzplaner/manifest.json >/dev/null && python -m json.tool hacs.json >/dev/null
```

- [ ] **Step 3: Run the complete gate and commit**

Run:

```bash
python3 -m unittest discover -s tests -v
node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs
node --check custom_components/finanzplaner/frontend/panel.js
python3 -m compileall -q custom_components
python3 -m json.tool custom_components/finanzplaner/manifest.json >/dev/null
python3 -m json.tool hacs.json >/dev/null
git diff --check
```

All tests and validators must exit with code 0. Then commit:

```bash
git add README.md CHANGELOG.md .github/workflows/validate.yml
git commit -m "docs: document excel migration workflow"
```
