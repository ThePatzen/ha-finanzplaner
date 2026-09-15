# Konten und Buchungsaufteilungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `v0.3.0` ergänzt automatisch erkannte Konten mit mehreren Kontoinhabern und einen Aufteilungseditor für centgenaue Buchungszuordnungen.

**Architecture:** Die fachliche Logik bleibt in den dependency-freien Funktionen von `core.py`; der versionierte Home-Assistant-Store übernimmt die Migration von Version 1 auf 2. Import und neue Konten- beziehungsweise Aufteilungsaktionen werden über authentifizierte `HomeAssistantView`-Endpunkte angeboten. Das bestehende native Web-Component-Panel erhält eine Kontenansicht und eine dynamische Aufteilungsansicht; alle Panel-Anfragen verwenden `hass.fetchWithAuth()`.

**Tech Stack:** Python 3.13 Standardbibliothek (`dataclasses`, `decimal`, `hashlib`, `datetime`), Home Assistant `Store`, `HomeAssistantView` und `DataUpdateCoordinator`, native Web Component JavaScript, Node-Test-Runner und Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-09-15-accounts-allocation-design.md`

## Global Constraints

- Der Store erhöht seine Versionsnummer von `1` auf `2`.
- `v0.3.0` enthält automatische Kontoerkennung, Kontenverwaltung und den Aufteilungseditor; automatische Regeln bleiben ein anschließender Ausbau.
- Eine IBAN wird ohne Leerzeichen und in Großschreibung verglichen.
- `owner_targets` enthält eindeutige `person.*`-Entity-IDs oder `household`.
- Kontoinhaber beschreiben nur die Zahlungsquelle und werden nie automatisch als Buchungsziele verwendet.
- `Hunde` wird über `area="Hunde"` modelliert; eine Hundebuchung verwendet typischerweise `target="household"`.
- Verbindliche Aufteilungen speichern positive Eurobeträge mit zwei Nachkommastellen; ihre Summe muss dem Absolutwert der Buchung entsprechen.
- Die erste Aufteilung erhält bei einer gleichmäßigen Teilung den deterministischen Rundungsrest.
- Unbekannte Konten werden ohne Inhaber angelegt und bleiben für die Buchungszuordnung neutral.
- Originale Bank- und Excel-Dateien werden nicht dauerhaft gespeichert.
- Vollständige IBANs werden nur lokal gespeichert und in der UI maskiert.
- Direkte Änderungen an HA-internen `.storage`-Dateien sind ausgeschlossen.
- Keine automatische Regel speichert eine Buchungszuordnung ohne Nutzerbestätigung.
- Jeder Task endet mit einem fokussierten Testlauf und einem lokalen Git-Commit.

## Bestehende Struktur und Verantwortlichkeiten

- `custom_components/finanzplaner/core.py`: domain- und geldwertgenaue Funktionen, Parserdatenmodelle und Aufteilungsvalidierung.
- `custom_components/finanzplaner/storage.py`: `FinanceStore`, Default-Daten und versionierte Migration.
- `custom_components/finanzplaner/http.py`: authentifizierte Übersicht-, Personen-, Import- und Prüflisten-Endpunkte.
- `custom_components/finanzplaner/frontend/panel.js`: native Finanzplaner-Ansicht, Navigation und Upload-/Zuordnungsaktionen.
- `custom_components/finanzplaner/frontend/panel-utils.mjs`: testbare Frontend-Hilfsfunktionen inklusive Home-Assistant-Authentifizierung.
- `tests/test_finanzplaner_core.py`: Python-Domainregeln und Importparser.
- `tests/test_excel_api_payloads.py`: HTTP-Payload- und Persistenzgrenzen für die Excel-Vorschau.
- `tests/test_panel_static_assets.py`: Release-scoped Frontend-URLs.
- `custom_components/finanzplaner/manifest.json`: veröffentlichte Integrationsversion.
- `CHANGELOG.md`: nachvollziehbare Releaseänderungen.

---

### Task 1: Kontoidentität und Store-Migration

**Files:**
- Modify: `custom_components/finanzplaner/const.py`
- Modify: `custom_components/finanzplaner/core.py`
- Modify: `custom_components/finanzplaner/storage.py`
- Create: `tests/test_accounts_and_migration.py`

**Interfaces:**
- Consumes: alte Store-Daten mit `version=1`, eine Kontoangabe aus MT940/CAMT.053 und den Haushaltsnamen.
- Produces: `STORAGE_VERSION = 2`, `normalize_account_reference(value: str) -> str`, `account_id_for_reference(value: str) -> str | None` und `migrate_store_data(stored: dict[str, object] | None, household_name: str) -> dict[str, object]`.

- [ ] **Step 1: Write the failing migration tests**

Add two tests that use only anonymized values and assert observable migrated data:

```python
def test_normalizes_iban_for_matching_without_changing_display_data(self):
    self.assertEqual(
        core.normalize_account_reference(" at12 3456 7890 1234 5678 "),
        "AT123456789012345678",
    )

def test_migrates_old_bookings_to_one_stable_account(self):
    migrated = migrate_store_data(
        {
            "version": 1,
            "settings": {"household_name": "Testhaushalt"},
            "accounts": [],
            "plan_items": [],
            "bookings": [
                {"id": "booking-1", "account": " AT12 3456 7890 1234 5678 ", "allocations": []},
                {"id": "booking-2", "account": "AT123456789012345678", "allocations": []},
            ],
            "imports": [],
            "rules": [],
        },
        "Testhaushalt",
    )

    self.assertEqual(migrated["version"], 2)
    self.assertEqual(len(migrated["accounts"]), 1)
    self.assertEqual(migrated["bookings"][0]["account_id"], migrated["bookings"][1]["account_id"])
    self.assertEqual(migrated["bookings"][0]["account_reference"], "AT123456789012345678")
    self.assertEqual(migrated["accounts"][0]["owner_targets"], [])
```

- [ ] **Step 2: Run the focused tests and verify the red state**

Run:

```bash
python3 -m unittest tests.test_accounts_and_migration -v
```

Expected: failure because the normalization, stable account identity, and migration functions do not yet exist.

- [ ] **Step 3: Implement normalized account identity**

In `core.py`, normalize only matching data:

```python
def normalize_account_reference(value: str) -> str:
    return "".join(str(value or "").split()).upper()


def account_id_for_reference(value: str) -> str | None:
    normalized = normalize_account_reference(value)
    if not normalized:
        return None
    return f"account-{hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]}"
```

Keep the source field in a separate `account_reference`; do not derive an ID from the editable account label.

- [ ] **Step 4: Implement the version-1-to-version-2 migration**

In `storage.py`, construct defaults with `version=2`, normalize all existing nonempty booking account values, create one account per normalized reference, and attach its stable `account_id` to every matching booking. Preserve all unrelated keys, keep empty account references as `account_id=None`, and add missing `allocations` lists without replacing existing allocations.

Expose the pure migration function from `storage.py` and call it from `FinanceStore.async_load()` before assigning `self.data`. The migration must not write until the normal `async_save()` call.

- [ ] **Step 5: Run the focused tests and commit**

Run:

```bash
python3 -m unittest tests.test_accounts_and_migration -v
python3 -m compileall -q custom_components tests
```

Expected: all migration tests pass.

```bash
git add custom_components/finanzplaner/const.py custom_components/finanzplaner/core.py custom_components/finanzplaner/storage.py tests/test_accounts_and_migration.py
git commit -m "feat: add account identity and store migration"
```

### Task 2: Automatic account discovery during bank import

**Files:**
- Modify: `custom_components/finanzplaner/http.py`
- Modify: `custom_components/finanzplaner/core.py`
- Modify: `tests/test_finanzplaner_core.py`
- Create: `tests/test_account_import.py`

**Interfaces:**
- Consumes: normalized `Booking.account` values from `parse_mt940()` and `parse_camt053()`.
- Produces: `ensure_account(data: dict[str, object], account_reference: str, iban: str | None = None) -> tuple[dict[str, object] | None, bool]` and booking payloads containing `account_id` plus `account_reference`.

- [ ] **Step 1: Write failing account-discovery tests**

Add tests for one CAMT IBAN, one MT940 account reference, and repeated discovery:

```python
def test_ensure_account_reuses_normalized_reference(self):
    data = {"accounts": []}

    first, created_first = ensure_account(data, " AT12 3456 7890 1234 5678 ", "AT123456789012345678")
    second, created_second = ensure_account(data, "AT123456789012345678")

    self.assertTrue(created_first)
    self.assertFalse(created_second)
    self.assertEqual(first["id"], second["id"])
    self.assertEqual(first["iban"], "AT123456789012345678")
    self.assertEqual(first["owner_targets"], [])

def test_mt940_reference_without_iban_is_stored_as_account_reference(self):
    data = {"accounts": []}

    account, created = ensure_account(data, "BANK-ACCOUNT-42")

    self.assertTrue(created)
    self.assertEqual(account["iban"], None)
    self.assertEqual(account["account_reference"], "BANK-ACCOUNT-42")
```

- [ ] **Step 2: Run the focused tests and verify the red state**

Run:

```bash
python3 -m unittest tests.test_account_import -v
```

Expected: failure because account discovery is not implemented.

- [ ] **Step 3: Implement account creation and matching**

Create accounts with this shape:

```python
{
    "id": account_id_for_reference(account_reference),
    "label": f"Konto · {account_reference[-4:]}",
    "iban": normalize_account_reference(iban) if iban else None,
    "account_reference": normalize_account_reference(account_reference),
    "currency": "EUR",
    "owner_targets": [],
    "active": True,
    "created_at": now_iso,
    "updated_at": now_iso,
}
```

Use the IBAN as the preferred match key when available, otherwise use the normalized MT940 reference. Do not overwrite the label, IBAN, owners, or active state of an existing account from a later import.

- [ ] **Step 4: Wire discovery into `ImportView.post()`**

Before appending each accepted booking, call `ensure_account()` and add `account_id` and `account_reference` to `_booking_payload()`. Keep the existing booking fingerprint and duplicate behavior. The import response adds `new_accounts` and `unconfigured_accounts` counts without returning full IBANs.

If parsing raises an `XlsxImportError`, XML error, or MT940 error, do not create accounts. Account creation only happens after the parser has produced normalized bookings.

- [ ] **Step 5: Run all current Python tests and commit**

Run:

```bash
python3 -m unittest tests.test_account_import tests.test_finanzplaner_core -v
python3 -m compileall -q custom_components tests
```

Expected: all focused parser, fingerprint, and account-discovery tests pass.

```bash
git add custom_components/finanzplaner/core.py custom_components/finanzplaner/http.py tests/test_finanzplaner_core.py tests/test_account_import.py
git commit -m "feat: discover accounts during bank imports"
```

### Task 3: Authenticated account API

**Files:**
- Modify: `custom_components/finanzplaner/http.py`
- Create: `tests/test_account_payloads.py`

**Interfaces:**
- Consumes: `GET /api/finanzplaner/persons`, account records in `coordinator.store.data`, and authenticated requests from the panel.
- Produces: `GET /api/finanzplaner/accounts`, `POST /api/finanzplaner/accounts/{account_id}`, `account_payload(account: dict[str, object]) -> dict[str, object]`, and `validate_account_update(payload: object, valid_targets: set[str]) -> dict[str, object]`.

- [ ] **Step 1: Write failing account API contract tests**

Test the pure response and update validation without importing Home Assistant:

```python
def test_account_payload_masks_iban_but_keeps_last_four_digits(self):
    payload = account_payload({"id": "account-1", "label": "Giro", "iban": "AT123456789012345678"})

    self.assertEqual(payload["label"], "Giro")
    self.assertEqual(payload["iban_masked"], "•••• 5678")
    self.assertNotIn("iban", payload)

def test_account_update_accepts_multiple_live_people_and_household(self):
    result = validate_account_update(
        {"label": "Gemeinsames Girokonto", "owner_targets": ["person.alex", "person.sam", "household"], "active": True},
        {"person.alex", "person.sam", "household"},
    )

    self.assertEqual(result["owner_targets"], ["person.alex", "person.sam", "household"])
```

Add a rejection test for an unknown target and duplicate target.

- [ ] **Step 2: Run the focused tests and verify the red state**

Run:

```bash
python3 -m unittest tests.test_account_payloads -v
```

Expected: failure because account payload masking and update validation do not yet exist.

- [ ] **Step 3: Implement account payload and update validation**

Mask the full IBAN at the response boundary and preserve only the last four characters after normalization. Validate nonempty labels, `owner_targets` as unique strings from the current `person.*` set plus `household`, and boolean `active`. Reject invalid input with `ValueError` before touching the store.

- [ ] **Step 4: Add authenticated HTTP views**

Add:

```python
class AccountsView(HomeAssistantView):
    url = "/api/finanzplaner/accounts"
    requires_auth = True


class AccountView(HomeAssistantView):
    url = "/api/finanzplaner/accounts/<account_id>"
    requires_auth = True
```

`GET` returns `{ "accounts": [...] }` with masked data. `POST` validates current live persons from `hass.states`, updates only label, owner targets, active, and `updated_at`, then saves and refreshes the coordinator. Unknown account IDs return 404; invalid targets return 400; failed validation leaves the store unchanged.

Register both views in `async_setup()` alongside the existing authenticated views.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
python3 -m unittest tests.test_account_payloads tests.test_accounts_and_migration -v
```

Expected: all account API and authenticated frontend tests pass.

```bash
git add custom_components/finanzplaner/http.py tests/test_account_payloads.py
git commit -m "feat: add authenticated account API"
```

### Task 4: Kontenansicht im nativen Panel

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel.js`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.test.mjs`

**Interfaces:**
- Consumes: `GET /api/finanzplaner/accounts`, `GET /api/finanzplaner/persons`, and `POST /api/finanzplaner/accounts/{account_id}` through `fetchWithHomeAssistantAuth()`.
- Produces: a working `accounts` panel view with multi-select owners, maskierte Kontoangabe, editable label, active archive state, and explicit save feedback.

- [ ] **Step 1: Write failing frontend behavior tests**

Add pure helpers in `panel-utils.mjs` and tests for the visible account status:

```js
test("labels an account without owners as not configured", () => {
  assert.equal(utils.accountOwnerStatus([]), "Inhaber noch nicht konfiguriert");
  assert.equal(utils.accountOwnerStatus(["person.alex", "person.sam"]), "2 Kontoinhaber");
});
```

- [ ] **Step 2: Run the focused Node test and verify the red state**

Run:

```bash
node custom_components/finanzplaner/frontend/panel-utils.test.mjs
```

Expected: failure because `accountOwnerStatus()` is not exported.

- [ ] **Step 3: Implement the account view**

Add an `accounts` view state to the panel. Load accounts and live persons in parallel with authenticated requests. Render one account card per account with:

- label input
- masked IBAN or account reference
- owner multi-select containing current `person.*` entities and `Haushalt`
- status for zero, one, or multiple owners
- active/archive toggle
- save button and a live status message

Use account IDs as DOM data attributes. On save, send only `label`, `owner_targets`, and `active`; reload accounts after a successful response. Do not display or submit a full IBAN.

- [ ] **Step 4: Wire navigation without changing the HA home link**

Change the prepared settings navigation label/action to open the account view. Keep the brand link's base-path-safe Home-Assistant destination unchanged and keep the review route working from both overview and account views.

- [ ] **Step 5: Run frontend checks and commit**

Run:

```bash
node custom_components/finanzplaner/frontend/panel-utils.test.mjs
node --check custom_components/finanzplaner/frontend/panel.js
```

Expected: all Node tests pass and the panel parses successfully.

```bash
git add custom_components/finanzplaner/frontend/panel.js custom_components/finanzplaner/frontend/panel-utils.mjs custom_components/finanzplaner/frontend/panel-utils.test.mjs
git commit -m "feat: add account management view"
```

### Task 5: Geldgenaue Aufteilungsvalidierung und API

**Files:**
- Modify: `custom_components/finanzplaner/core.py`
- Modify: `custom_components/finanzplaner/http.py`
- Modify: `tests/test_finanzplaner_core.py`
- Create: `tests/test_allocation_payloads.py`

**Interfaces:**
- Consumes: a booking amount, a JSON allocation list, live valid person entity IDs, and optional `Hunde` area.
- Produces: `parse_allocation_payload(payload: object, total: float, valid_targets: set[str]) -> list[Allocation]` and `POST /api/finanzplaner/bookings/{booking_id}/allocations`.

- [ ] **Step 1: Write failing allocation tests**

Add tests with literal cent expectations:

```python
def test_parses_custom_cent_allocation(self):
    allocations = parse_allocation_payload(
        [
            {"target": "person.alex", "amount": 60.00},
            {"target": "person.sam", "amount": 20.00},
            {"target": "household", "amount": 20.00, "area": "Hunde"},
        ],
        100.00,
        {"person.alex", "person.sam", "household"},
    )

    self.assertEqual([item.amount for item in allocations], [60.0, 20.0, 20.0])
    self.assertEqual(allocations[2].area, "Hunde")

def test_rejects_allocation_with_remaining_amount(self):
    with self.assertRaises(ValueError):
        parse_allocation_payload(
            [{"target": "person.alex", "amount": 99.99}],
            100.00,
            {"person.alex"},
        )
```

Add tests for unknown targets, duplicate targets, negative amounts, more than two decimal places, and a valid `33.34 / 33.33 / 33.33` split.

- [ ] **Step 2: Run the focused tests and verify the red state**

Run:

```bash
python3 -m unittest tests.test_allocation_payloads -v
```

Expected: failure because the allocation payload parser does not exist.

- [ ] **Step 3: Implement server-side amount parsing**

Parse numbers through `Decimal(str(value))`, reject booleans, nonfinite values, negative values, and values whose quantized cent representation differs from the supplied value. Build `Allocation` objects only after every row is valid. Call `validate_allocations()` and raise `ValueError("Die Aufteilung deckt den Buchungsbetrag nicht centgenau ab.")` when the sum is wrong.

- [ ] **Step 4: Add the allocation endpoint**

Create `BookingAllocationsView` at `/api/finanzplaner/bookings/<booking_id>/allocations` with `requires_auth = True`. Resolve current persons from `hass.states`, accept only `person.*` IDs and `household`, allow `area=None` or `area="Hunde"`, and validate category/project as optional strings. Look up the booking, parse the payload, write allocation dictionaries, set `status="resolved"`, save, refresh, and return the booking.

The existing legacy endpoint `/api/finanzplaner/bookings/<booking_id>` remains available for the current equal-split client until the new panel is deployed; it must continue to use the same server validation rules after the new endpoint is introduced.

- [ ] **Step 5: Add error response coverage and commit**

Run:

```bash
python3 -m unittest tests.test_allocation_payloads tests.test_finanzplaner_core -v
python3 -m compileall -q custom_components tests
```

Expected: all allocation, rounding, and existing core tests pass.

```bash
git add custom_components/finanzplaner/core.py custom_components/finanzplaner/http.py tests/test_finanzplaner_core.py tests/test_allocation_payloads.py
git commit -m "feat: validate custom booking allocations"
```

### Task 6: Aufteilungseditor im Review-Panel

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel.js`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.mjs`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.test.mjs`

**Interfaces:**
- Consumes: unresolved bookings, live persons, `POST /api/finanzplaner/bookings/{booking_id}/allocations`, and the pure draft helpers.
- Produces: dynamic allocation rows with equal-split defaults, editable amount fields, remaining amount feedback, Hunde area, and server-confirmed resolution.

- [ ] **Step 1: Write failing draft-helper tests**

Add and test pure browser helpers:

```js
test("splits a booking draft equally and assigns the remainder first", () => {
  assert.deepEqual(
    utils.equalAllocationDraft(100, ["person.alex", "person.sam", "household"]),
    [
      { target: "person.alex", amount: 33.34, area: null, category: null, project: null },
      { target: "person.sam", amount: 33.33, area: null, category: null, project: null },
      { target: "household", amount: 33.33, area: null, category: null, project: null },
    ],
  );
});

test("reports remaining cents for an edited draft", () => {
  assert.equal(utils.allocationRemaining(100, [{ amount: 60 }, { amount: 20 }]), 20);
});
```

- [ ] **Step 2: Run the focused Node test and verify the red state**

Run:

```bash
node custom_components/finanzplaner/frontend/panel-utils.test.mjs
```

Expected: failure because the draft helpers are not exported.

- [ ] **Step 3: Implement cent-safe frontend draft helpers**

Use integer cents in the helpers, return JSON-safe numeric euro amounts, and keep the same field shape for every row:

```js
{ target, amount, area: null, category: null, project: null }
```

`allocationRemaining(total, allocations)` returns the rounded euro difference `total - sum(amounts)`. It must not decide whether a server submission is valid; the backend remains authoritative.

- [ ] **Step 4: Replace the multi-select-only assignment form**

In the review template, render allocation rows with:

- single target select per row
- Euro amount input with `inputmode="decimal"`
- area select with `Kein Bereich` and `Hunde`
- optional category and project inputs
- add and remove row buttons
- total, assigned, and remaining summary
- submit disabled while there is no target or the remaining amount is nonzero

Initialize each unresolved booking with one `household` row containing the full absolute amount. When a row is added, rebalance all current rows equally using `equalAllocationDraft()`. When the user changes a target or amount, preserve manual amounts and update only the summary.

- [ ] **Step 5: Submit to the new endpoint and handle failures**

Send `{ "allocations": [...] }` through `fetchWithHomeAssistantAuth()`. On a successful response, remove the booking from the review list and refresh the overview. On a 400 response, show the server's text or JSON message without attempting to parse a plain-text error as successful JSON. Keep the draft visible so the user can correct the remaining cents.

- [ ] **Step 6: Run frontend checks and commit**

Run:

```bash
node custom_components/finanzplaner/frontend/panel-utils.test.mjs
node --check custom_components/finanzplaner/frontend/panel.js
```

Expected: all frontend tests pass and the panel parses successfully.

```bash
git add custom_components/finanzplaner/frontend/panel.js custom_components/finanzplaner/frontend/panel-utils.mjs custom_components/finanzplaner/frontend/panel-utils.test.mjs
git commit -m "feat: add booking allocation editor"
```

### Task 7: Integration checks, documentation, and `v0.3.0`

**Files:**
- Modify: `README.md`
- Modify: `PRODUCT.md`
- Modify: `CHANGELOG.md`
- Modify: `custom_components/finanzplaner/manifest.json`
- Modify: `custom_components/finanzplaner/__init__.py`
- Modify: `tests/test_panel_static_assets.py`

**Interfaces:**
- Consumes: completed account discovery, store migration, account API, account view, allocation API, and allocation editor.
- Produces: documented `v0.3.0`, versioned static panel URL, and a release candidate with all tests passing.

- [ ] **Step 1: Add migration and end-to-end contract checks**

Extend the existing Python tests so the following literal scenarios run together:

```python
def test_shared_account_does_not_assign_booking_to_its_owners(self):
    data = {
        "accounts": [{"id": "account-1", "owner_targets": ["person.alex", "person.sam"]}],
        "bookings": [{"id": "booking-1", "account_id": "account-1", "amount": -100.0, "allocations": [], "status": "unresolved"}],
    }
    self.assertEqual(data["bookings"][0]["allocations"], [])
```

Add assertions that `household + Hunde` is represented in one allocation row and that changing `owner_targets` leaves an existing booking allocation unchanged.

- [ ] **Step 2: Write failing frontend response-reader tests**

Add a pure `readApiResponse(response: Response) -> Promise<object | string>` contract test. Use one JSON response with `Content-Type: application/json` and one plain-text response with `Content-Type: text/plain`; assert that the first returns the parsed object and the second returns the exact text.

- [ ] **Step 3: Run the focused Node test and verify the red state**

Run:

```bash
node custom_components/finanzplaner/frontend/panel-utils.test.mjs
```

Expected: failure because `readApiResponse()` is not exported.

- [ ] **Step 4: Improve frontend response handling**

Add `readApiResponse()` in `panel-utils.mjs`; it checks the `Content-Type` before parsing JSON and otherwise returns trimmed response text. Use it in import, assignment, Excel preview, Excel confirmation, account save, and allocation save so a plain-text HA error becomes a readable status message rather than `JSON.parse` noise. For successful JSON responses, keep the existing object shape unchanged.

- [ ] **Step 5: Update documentation and version**

Document in `README.md` that accounts are discovered during bank import, owner targets come from Home Assistant persons, and allocations are confirmed in the review list. Update `PRODUCT.md` to mark account ownership and cent-based allocations as delivered. Add a `0.3.0` changelog entry, set the manifest version to `0.3.0`, and keep the existing static panel path derivation based on the manifest version.

- [ ] **Step 6: Run the complete available verification suite**

Run:

```bash
python3 -m unittest discover -s tests -p 'test*.py' -v
node custom_components/finanzplaner/frontend/panel-utils.test.mjs
node --check custom_components/finanzplaner/frontend/panel.js
python3 -m compileall -q custom_components tests
python3 -m json.tool custom_components/finanzplaner/manifest.json >/dev/null
git diff --check
```

`pytest` is not assumed because it is not installed in the current development environment. The equivalent repository tests use Python's standard-library `unittest` runner.

- [ ] **Step 7: Commit and release**

```bash
git add README.md PRODUCT.md CHANGELOG.md custom_components/finanzplaner/__init__.py custom_components/finanzplaner/manifest.json custom_components/finanzplaner/frontend/panel-utils.mjs custom_components/finanzplaner/frontend/panel-utils.test.mjs tests
git commit -m "release: v0.3.0"
git tag -a v0.3.0 -m "Release v0.3.0"
```

After a final clean-tree check, push `main` and `v0.3.0` only after the release handoff is approved.

## Spec-Coverage Checklist

- Account normalization and local account identity: Task 1.
- Store migration from version 1 to version 2: Task 1.
- CAMT.053 and MT940 automatic account discovery: Task 2.
- Multiple owners from live Home-Assistant persons: Tasks 3 and 4.
- Masked IBAN presentation and local-only storage: Tasks 2–4.
- Separation of account ownership from booking purpose: Tasks 1, 2, 5, and 7.
- Custom amount allocation with deterministic equal-split default: Tasks 5 and 6.
- `Haushalt` and shared `Hunde` area: Tasks 5 and 6.
- Server-side validation and unchanged store on invalid requests: Task 5.
- Authenticated panel requests and cache-safe panel URL: Tasks 3 and 7.
- Plain-text backend error handling: Task 7.
- Rule suggestion safety: documented in the spec and intentionally reserved for the next feature after `v0.3.0`.
- Tests for parser, migration, rounding, API contracts, and frontend behavior: Tasks 1–7.
