# Buchungshistorie, Auswertungen, Regeln und Personenreparatur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Historische Buchungen filterbar machen, gespeicherte Aufteilungen direkt bearbeitbar machen, Regelbedingungen erweitern, Monats-/Jahres-/Cashflow-Berichte und Sensoren ergänzen sowie fehlende Home-Assistant-Personenziele reparierbar machen.

**Architecture:** Die bestehende Storage-Version 2 bleibt kompatibel. Neue optionale Regel- und Aufteilungsfelder werden normalisiert; reine Core-Funktionen liefern Zeitraum- und Berichtsdaten. Authentifizierte HTTP-Views projizieren diese Daten, während `panel.js` die vorhandenen Formulare, Tabellen und Feedbackzustände erweitert.

**Tech Stack:** Python `unittest`, Home-Assistant `HomeAssistantView`, lokaler persistent Store, native HTML/CSS/JavaScript, Node `--test`.

**Spec:** `docs/superpowers/specs/2026-09-18-bookings-reports-rules-repair-design.md`

## Global Constraints

- Storage-Version 2 bleibt erhalten; alte Regeln erhalten für neue Felder den Wert `null`.
- Vollständige IBANs und Kontoreferenzen bleiben ausschließlich im lokalen Store.
- Neue HTTP-Views verwenden `requires_auth = True` und `_response_payload()`.
- `target`, Kontoinhaber und fachliche Katalog-/Tierzuordnungen bleiben getrennt.
- Centbeträge werden ausschließlich über die bestehende Aufteilungsvalidierung gespeichert.
- UI bleibt eine Operate-Oberfläche im bestehenden Marineblau-/Papier-/Cyan-/Amber-/Koralle-System.
- Jede Änderung erhält zuerst einen gezielt fehlschlagenden Test, danach die minimale Implementierung.

## Dateiübersicht

- Modify `custom_components/finanzplaner/core.py`: Regelbedingungen und reine Zeitraum-/Berichtsfunktionen.
- Modify `custom_components/finanzplaner/storage.py`: optionale Regel-/Aufteilungsfelder normalisieren und Ziel-Snapshots ergänzen.
- Modify `custom_components/finanzplaner/http.py`: Buchungsabfrage, Importhistorie, Bericht, Reparatur und Projektionen.
- Modify `custom_components/finanzplaner/sensor.py`: zusätzliche Koordinator-Sensoren.
- Modify `custom_components/finanzplaner/frontend/panel.js`: Filter, Historie, Editierdialoge, Berichtsauswahl, Regel- und Reparaturfelder.
- Modify `custom_components/finanzplaner/frontend/panel-utils.mjs`: filter-/report-/target-repair helpers.
- Modify `tests/test_finanzplaner_core.py`, `tests/test_rules.py`, `tests/test_rule_payloads.py`, `tests/test_account_import.py`, `tests/test_reminders.py`: fachliche und API-Regressionen.
- Create `tests/test_booking_history_reports.py`: API-Verträge für Abfrage, Importhistorie, Report und Reparatur.
- Modify `custom_components/finanzplaner/frontend/panel-utils.test.mjs`, `tests/test_panel_static_assets.py`: Frontend-Verhalten und Markup-Verträge.
- Modify `README.md`, `PRODUCT.md`, `CHANGELOG.md`: aktuelle Bedienung und Unreleased-Änderungen dokumentieren.

### Task 1: Regelbedingungen und Storage-Normalisierung

**Files:**
- Modify: `custom_components/finanzplaner/core.py:48-55,775-895,944-1055`
- Modify: `custom_components/finanzplaner/storage.py:209-246,552-618`
- Test: `tests/test_rules.py`, `tests/test_rule_payloads.py`

**Interfaces:**
- Produces `direction`, `counterparty_account`, `amount_min`, `amount_max` in validated rule payloads and rule projections.
- Keeps `rule_suggestion(booking, rules, *, accounts, valid_targets, catalogs, pets)` as the public matching entry point.

- [ ] **Step 1: Write failing tests**

```python
def test_rule_matches_direction_counterparty_account_and_amount_range(self):
    result = core.rule_suggestion(
        {"account_id": "account-main", "amount": -42.50,
         "counterparty": "Supermarkt", "counterparty_account": "AT123",
         "purpose": "Einkauf"},
        [{"id": "r1", "label": "Einkauf", "active": True, "priority": 10,
          "account_id": "account-main", "counterparty": "Supermarkt",
          "counterparty_account": "AT123", "direction": "expense",
          "amount_min": 40, "amount_max": 50,
          "allocations": [{"target": "household", "share_percent": 100}]}],
        accounts={"account-main": {}}, valid_targets={"household"},
        catalogs={"areas": [], "categories": [], "projects": []}, pets={},
    )
    assert result["status"] == "suggested"
```

```python
def test_legacy_rules_receive_null_optional_conditions_without_mutation(self):
    data = storage.normalize_current_store_data({"version": 2, "rules": [{"id": "r1"}]}, "Test")
    assert data["rules"][0]["amount_min"] is None
    assert data["rules"][0]["direction"] is None
```

- [ ] **Step 2: Run tests and verify the expected missing-condition failure**

Run: `python3 -m unittest tests.test_rules tests.test_rule_payloads -v`

Expected: FAIL because the new rule fields are rejected or ignored.

- [ ] **Step 3: Implement minimal validation and matching**

Add the optional fields to `RULE_FIELDS`, normalize account references and positive cent amounts, require `amount_min <= amount_max`, and compare all supplied conditions in `_rule_matches_booking`. Extend matching reasons with only the conditions actually used.

- [ ] **Step 4: Normalize old records and run focused tests**

Run: `python3 -m unittest tests.test_rules tests.test_rule_payloads -v`

Expected: PASS, including all existing priority/conflict tests.

- [ ] **Step 5: Commit attempt**

Run: `git add custom_components/finanzplaner/core.py custom_components/finanzplaner/storage.py tests/test_rules.py tests/test_rule_payloads.py && git commit -m "feat: extend booking rule conditions"`

If the environment still rejects `.git/index.lock`, leave the files staged only if possible and report the limitation.

### Task 2: Period-, Jahres- und Cashflow-Core

**Files:**
- Modify: `custom_components/finanzplaner/core.py:1407-1677,1918-1990`
- Test: `tests/test_finanzplaner_core.py`

**Interfaces:**
- Produces `overview_period(data, start: date, end: date) -> dict[str, object]`.
- Produces `cashflow_series(data, start: date, end: date) -> list[dict[str, object]]`.
- Produces `overview_report(data, start: date, end: date) -> dict[str, object]`.
- Existing `overview_values(data, month)` and `overview_comparison(data, month)` remain compatible.

- [ ] **Step 1: Write failing tests**

```python
def test_overview_period_and_cashflow_series_cover_year_without_double_counting(self):
    period = core.overview_period(data, date(2026, 1, 1), date(2026, 12, 31))
    assert period["actual"] == 1200.00
    assert period["unresolved_count"] == 1
    series = core.cashflow_series(data, date(2026, 1, 1), date(2026, 12, 31))
    assert [entry["month"] for entry in series] == ["2026-01", "2026-02"]
```

```python
def test_overview_report_exposes_person_account_and_pet_dimensions(self):
    report = core.overview_report(data, date(2026, 1, 1), date(2026, 12, 31))
    assert "persons" in report["dimensions"]
    assert "accounts" in report["dimensions"]
    assert "pets" in report["dimensions"]
```

- [ ] **Step 2: Run the focused tests and verify missing-function failures**

Run: `python3 -m unittest tests.test_finanzplaner_core -v`

Expected: FAIL with missing `overview_period`/`cashflow_series`/`overview_report`.

- [ ] **Step 3: Implement period aggregation**

Reuse `plan_item_month_values`, `feed_profile_month_values`, booking allocation signs and existing catalog labels. Count unresolved bookings separately and include expected feed purchases only once.

- [ ] **Step 4: Implement monthly cashflow series and dimensions**

Generate one entry per month in the inclusive range and aggregate income, expenses, savings, plan, forecast and actual. Group allocations by category, area, project, person, account and pet while preserving `Nicht zugeordnet` buckets.

- [ ] **Step 5: Run focused and full Python tests**

Run: `python3 -m unittest tests.test_finanzplaner_core -v && python3 -m unittest discover -s tests -p 'test*.py' -q`

Expected: PASS with no changes to existing monthly contracts.

### Task 3: Booking history, import history, reports and repair API

**Files:**
- Create: `tests/test_booking_history_reports.py`
- Modify: `custom_components/finanzplaner/http.py:1963-2123,2280-2381,2385-2590`
- Modify: `custom_components/finanzplaner/__init__.py` where views are registered

**Interfaces:**
- Adds `GET /api/finanzplaner/bookings` with `q`, `from`, `to`, `account_id`, `target`, `category_id`, `area_id`, `project_id`, `status`, `limit`, `offset`.
- Adds `GET /api/finanzplaner/imports` without upload bytes.
- Adds `GET /api/finanzplaner/report?from=YYYY-MM-DD&to=YYYY-MM-DD&view=month|year|cashflow`.
- Adds `POST /api/finanzplaner/bookings/{booking_id}/repair-targets` with `{"repairs": [{"from": "person.old", "to": "person.new"}]}`.

- [ ] **Step 1: Write failing API tests**

```python
def test_booking_history_filters_and_paginates_without_exposing_source_bytes(self):
    response = await view.get(request_with_query(q="rent", status="resolved", limit="1"))
    payload = response.json()
    assert payload["total"] == 2
    assert len(payload["bookings"]) == 1
    assert "source_data" not in payload["bookings"][0]
```

```python
def test_repair_targets_replaces_only_person_reference_and_preserves_amount(self):
    response = await repair_view.post(request, "booking-1")
    assert response.status == 200
    assert store.data["bookings"][0]["allocations"][0]["amount"] == 12.34
    assert store.data["bookings"][0]["allocations"][0]["target"] == "person.new"
```

- [ ] **Step 2: Run the new tests and verify route/function failures**

Run: `python3 -m unittest tests.test_booking_history_reports -v`

Expected: FAIL because the new views are not registered.

- [ ] **Step 3: Implement shared booking filter/projection helpers**

Parse dates strictly, normalize text casefolded search values, filter allocations for target/catalog fields, reject invalid limits/offsets without mutation, and return masked booking projections plus `total`, `limit`, `offset` and `filters`.

- [ ] **Step 4: Implement import-history and report views**

Project only stored import metadata and call the new Core report functions. Never include `original_uploads.content_base64`.

- [ ] **Step 5: Implement target repair with transactional validation**

Validate every requested destination against current `person.*` states or `household` before changing any allocation. Apply all replacements, preserve amounts and snapshots, save once, refresh once, and return the projected booking.

- [ ] **Step 6: Run API and full Python tests**

Run: `python3 -m unittest tests.test_booking_history_reports -v && python3 -m unittest discover -s tests -p 'test*.py' -q`

Expected: PASS with no full account references in response bodies.

### Task 4: Direct resolved-allocation editing and target status projection

**Files:**
- Modify: `custom_components/finanzplaner/http.py:698-766,2280-2349`
- Modify: `custom_components/finanzplaner/storage.py:209-246`
- Modify: `custom_components/finanzplaner/frontend/panel.js:1268-1340,3610-3690,4618-4652`
- Test: `tests/test_rule_payloads.py`, `tests/test_panel_static_assets.py`

**Interfaces:**
- `_allocation_records()` stores a `target_label` snapshot when a live person is available.
- Booking projections add `target_status` per allocation: `available`, `household`, or `missing`.
- The existing `POST /bookings/{id}/allocations` remains the save endpoint for both unresolved and resolved bookings.

- [ ] **Step 1: Write failing backend and static UI tests**

```python
def test_resolved_allocation_update_preserves_account_and_cent_amounts(self):
    response = await allocations_view.post(request_for("booking-1"), "booking-1")
    assert response.status == 200
    assert store.data["bookings"][0]["account_id"] == "account-main"
    assert sum(row["amount"] for row in store.data["bookings"][0]["allocations"]) == 42.37
```

```python
def test_resolved_rows_offer_edit_action_and_missing_target_marker(self):
    source = Path("custom_components/finanzplaner/frontend/panel.js").read_text()
    assert "data-edit-resolved-booking" in source
    assert "Person fehlt" in source
```

- [ ] **Step 2: Run tests and verify the edit affordance is absent**

Run: `python3 -m unittest tests.test_rule_payloads tests.test_panel_static_assets -v`

Expected: the backend regression passes only after target snapshots are added; the static test fails until the button/dialog is present.

- [ ] **Step 3: Add safe target snapshots/statuses**

Resolve live person names only at projection/save time, keep the old target string when the entity disappeared, and never reject a historical allocation merely because its person is missing.

- [ ] **Step 4: Add the resolved edit dialog**

Reuse the review allocation draft and submit validation. Add explicit `Bearbeiten`, `Speichern`, `Abbrechen`, loading and error states. After save reload resolved bookings and overview without changing account fields.

- [ ] **Step 5: Run Python and static UI tests**

Run: `python3 -m unittest tests.test_rule_payloads tests.test_panel_static_assets -v`

Expected: PASS.

### Task 5: Additional sensors

**Files:**
- Modify: `custom_components/finanzplaner/sensor.py:16-29`
- Test: `tests/test_finanzplaner_core.py`, `tests/test_reminders.py`

**Interfaces:**
- Adds sensor keys `planned_income`, `planned_expenses`, `planned_savings`, `forecast`, `unresolved_amount`, `household_balance`, `next_major_payment`.
- Uses current coordinator overview/report data and keeps `next_feed_purchase` unchanged.

- [ ] **Step 1: Write failing sensor contract tests**

```python
def test_finance_sensor_exposes_report_metrics(self):
    assert {key for key, _, _ in sensor.SENSORS} >= {
        "planned_income", "planned_expenses", "planned_savings",
        "forecast", "unresolved_amount", "household_balance", "next_major_payment",
    }
```

- [ ] **Step 2: Run the focused test and verify missing keys**

Run: `python3 -m unittest tests.test_reminders -v`

Expected: FAIL because the new keys are not registered.

- [ ] **Step 3: Add keys, values and units**

Use EUR for monetary sensors, a date string for `next_major_payment`, and `0`/`None` only for genuinely absent values. Do not create one entity per booking.

- [ ] **Step 4: Run focused and full tests**

Run: `python3 -m unittest tests.test_reminders tests.test_finanzplaner_core -v && python3 -m unittest discover -s tests -p 'test*.py' -q`

Expected: PASS.

### Task 6: Panel filters, reports, rules and repair UI

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel-utils.mjs`
- Modify: `custom_components/finanzplaner/frontend/panel.js`
- Test: `custom_components/finanzplaner/frontend/panel-utils.test.mjs`, `tests/test_panel_static_assets.py`

**Interfaces:**
- Adds pure helpers for serializing booking filters, report ranges and repair payloads.
- Adds filter state with `q`, `from`, `to`, `status`, account and catalog fields.
- Adds report state for `month`, `year`, `cashflow` and a resolved-booking allocation editor.

- [ ] **Step 1: Read `reference/craft-floor.md` and write failing helper tests**

```javascript
test("serializes booking filters without empty parameters", () => {
  assert.equal(utils.bookingHistoryRequestUrl("/api/finanzplaner/bookings", {
    q: "rent", status: "resolved", account_id: "account-main",
  }), "/api/finanzplaner/bookings?q=rent&status=resolved&account_id=account-main");
});
```

Run: `node custom_components/finanzplaner/frontend/panel-utils.test.mjs`

Expected: FAIL because the helper is not exported.

- [ ] **Step 2: Implement helper functions and verify Node tests**

Implement deterministic `URLSearchParams` ordering, date-range labels, and repair payload serialization. Run the focused Node test again and require PASS.

- [ ] **Step 3: Add booking history/filter and import-history UI**

Use semantic labelled controls, keep filter state through reloads, show result count and a distinct empty state, and load import metadata without bytes.

- [ ] **Step 4: Add resolved allocation edit and missing-person repair UI**

Use the existing allocation editor with explicit focus return, visible errors and no destructive implicit unresolve. Show `Person fehlt` beside affected rows and offer replacement mapping.

- [ ] **Step 5: Add rule condition controls**

Add direction select, masked counterparty-account input/select, minimum and maximum amount fields, client validation, and server-error mapping while preserving existing drafts.

- [ ] **Step 6: Add year/cashflow report views**

Add a compact report switcher to the overview, render semantic tables for period totals and cashflow series, and preserve the existing monthly overview as the default. Verify responsive horizontal scrolling, keyboard order, loading, error and empty states.

- [ ] **Step 7: Run frontend static checks**

Run: `node custom_components/finanzplaner/frontend/panel-utils.test.mjs && node --check custom_components/finanzplaner/frontend/panel.js && python3 -m unittest tests.test_panel_static_assets -v`

Expected: PASS where Node is installed; if unavailable, record the exact environment limitation and still run the Python static tests.

### Task 7: Documentation and integration consistency

**Files:**
- Modify: `README.md`, `PRODUCT.md`, `CHANGELOG.md`
- Test: `tests/test_panel_static_assets.py`, `git diff --check`

- [ ] **Step 1: Write a documentation consistency check**

Confirm the README names the new history/filter, report, rule and person-repair workflows and does not claim unsupported automatic file watching or Open Banking.

- [ ] **Step 2: Update documentation**

Document query filters, rule amount/direction conditions, report modes, sensor names and the person-repair behavior under `Unreleased`.

- [ ] **Step 3: Verify docs and diff**

Run: `git diff --check && rg -n "Buchungshistorie|Cashflow|Betragsspanne|Person fehlt|Importhistorie" README.md PRODUCT.md CHANGELOG.md`

Expected: all terms are present and no whitespace errors are reported.

### Task 8: Final verification

**Files:**
- Test: all repository tests and syntax/format checks.

- [ ] **Step 1: Run the complete verification set**

```bash
python3 -m unittest discover -s tests -p 'test*.py' -v
node custom_components/finanzplaner/frontend/panel-utils.test.mjs
node --check custom_components/finanzplaner/frontend/panel.js
python3 -m compileall -q custom_components tests
python3 -m json.tool custom_components/finanzplaner/manifest.json >/dev/null
git diff --check
```

- [ ] **Step 2: Review requirement coverage**

Check each item in the specification: filtered history, import metadata, direct allocation editing, six rule condition types, month/year/cashflow reports, expanded sensors, missing-person marking and repair, masking, and no mutation on invalid requests.

- [ ] **Step 3: Inspect final diff**

Run: `git status --short && git diff --stat && git diff --name-only`

Expected: only the planned implementation, tests and documentation files are changed.
