# Kategorie-Gruppierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unterkategorien dürfen unter verschiedenen Hauptkategorien denselben Namen tragen, werden als sauberer Pfad angezeigt und können in der Statistik wahlweise strukturell getrennt oder nach Namen zusammengefasst werden.

**Architecture:** Die bestehende stabile Kategorie-ID bleibt für alle vorhandenen Einträge unverändert. Neue IDs berücksichtigen bei Unterkategorien den Elternkontext; Kataloge und HTTP-Prüfungen verwenden `(parent_id, label.casefold())` als Eindeutigkeitsbereich. Die Statistik erhält einen expliziten Gruppierungsmodus, während das Frontend eine gemeinsame Pfaddarstellung und einen zugänglichen Umschalter für Kategorien verwendet.

**Tech Stack:** Python `unittest`, native Home-Assistant-HTTP-Views, lokale JSON-Persistenz, natives HTML/CSS und browserseitiges JavaScript mit Node `--test`.

**Spec:** `docs/superpowers/specs/2026-09-18-category-grouping-design.md`

## Global Constraints

- Es bleibt bei höchstens einer Unterkategorie-Ebene.
- Bestehende Kategorie-IDs dürfen sich nicht ändern.
- Der Statistik-Standard bleibt `category_grouping=structure`.
- `category_grouping` akzeptiert ausschließlich `structure` und `name`.
- Namensgruppen verwenden stabile Schlüssel mit dem Präfix `category-name:`.
- Frontend-Änderungen folgen der Impeccable-Operate-Leitlinie und werden mit Detector, Syntaxprüfung, Tests und `git diff --check` geprüft.
- Versionierung, Push und GitHub-Release sind nicht Bestandteil dieser Implementierung.

---

### Task 1: Elternkontext für Kataloge und stabile Unterkategorie-IDs

**Files:**
- Modify: `custom_components/finanzplaner/core.py:68-73`
- Modify: `custom_components/finanzplaner/storage.py:285-345,407-450`
- Test: `tests/test_pets.py:142-205`

**Interfaces:**
- Produces `catalog_id_for_label(kind: str, label: str, parent_id: str | None = None) -> str`.
- Produces parent-scoped catalog normalization where the deduplication key is `(parent_id or "", label.casefold())`.
- Preserves the legacy ID material whenever `parent_id is None`.

- [ ] **Step 1: Write the failing tests**

Add these behaviors to `CatalogDomainTests`:

```python
def test_same_subcategory_label_survives_under_different_parents(self):
    house_id = catalog_id_for_label("categories", "Haus")
    bank_id = catalog_id_for_label("categories", "Bank")
    migrated = migrate_store_data(
        {
            "version": 2,
            "catalogs": {"categories": [
                {"id": house_id, "label": "Haus"},
                {"id": bank_id, "label": "Bank"},
                {"label": "Gebühren", "parent_id": house_id},
                {"label": "Gebühren", "parent_id": bank_id},
            ]},
        },
        "Testhaushalt",
    )
    fees = [entry for entry in migrated["catalogs"]["categories"] if entry["label"] == "Gebühren"]
    self.assertEqual({entry["parent_id"] for entry in fees}, {house_id, bank_id})
    self.assertEqual(len({entry["id"] for entry in fees}), 2)

def test_legacy_top_level_catalog_id_stays_unchanged(self):
    self.assertEqual(
        catalog_id_for_label("categories", "Gebühren"),
        catalog_id_for_label("categories", "Gebühren", None),
    )
    self.assertNotEqual(
        catalog_id_for_label("categories", "Gebühren", "category-house"),
        catalog_id_for_label("categories", "Gebühren", "category-bank"),
    )
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
python3 -m unittest tests.test_pets.CatalogDomainTests -v
```

Expected: the new migration test drops one `Gebühren` entry and the ID test raises because `catalog_id_for_label` has no parent argument.

- [ ] **Step 3: Implement the minimal storage and ID changes**

Change `catalog_id_for_label` so the old material remains `f"{kind}:{label.casefold()}"` for top-level entries and the parent ID is included only for a child. In `_normalize_catalogs`, normalize a string `parent_id` before constructing the deduplication key, use `(parent_id or "", label.casefold())`, and pass the parent ID to the ID helper when an entry has no explicit ID. Keep the existing one-level cleanup and source-label backfill; source labels without a parent remain top-level entries. Update `ensure_catalog_entries` to use the same scoped duplicate key for the entries it creates.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run:

```bash
python3 -m unittest tests.test_pets.CatalogDomainTests -v
```

Expected: all catalog domain tests pass, including the existing legacy-ID assertions.

- [ ] **Step 5: Commit the task**

```bash
git add custom_components/finanzplaner/core.py custom_components/finanzplaner/storage.py tests/test_pets.py
git commit -m "feat: scope subcategories by parent"
```

### Task 2: Elternbezogene Katalog-API-Prüfung

**Files:**
- Modify: `custom_components/finanzplaner/http.py:1335-1430`
- Test: `tests/test_pets.py:650-730`

**Interfaces:**
- Create and update endpoints reject only a duplicate with the same normalized parent and case-insensitive label.
- Create endpoint passes `parent_id` to `catalog_id_for_label`.
- Existing update behavior continues to preserve historical snapshots and stable IDs.

- [ ] **Step 1: Write the failing API tests**

Extend `test_category_api_keeps_parent_on_partial_update_and_rejects_nested_parent` with two top-level parents and the same child label:

```python
bank = asyncio.run(
    self.http.CatalogEntriesView().post(
        self._request({"label": "Bank", "active": True}), "categories"
    )
)["catalog"]
house_fee = asyncio.run(
    self.http.CatalogEntriesView().post(
        self._request({"label": "Gebühren", "parent_id": shopping["id"]}), "categories"
    )
)["catalog"]
bank_fee = asyncio.run(
    self.http.CatalogEntriesView().post(
        self._request({"label": "Gebühren", "parent_id": bank["id"]}), "categories"
    )
)["catalog"]
self.assertNotEqual(house_fee["id"], bank_fee["id"])
with self.assertRaises(self.bad_request):
    asyncio.run(
        self.http.CatalogEntriesView().post(
            self._request({"label": " gebühren ", "parent_id": shopping["id"]}),
            "categories",
        )
    )
```

Also add an update assertion that renaming a child to a name already used under its current parent is rejected, while a same-name child under the other parent remains allowed.

- [ ] **Step 2: Run the API tests to verify they fail**

Run:

```bash
python3 -m unittest tests.test_pets.PetApiTests.test_category_api_keeps_parent_on_partial_update_and_rejects_nested_parent -v
```

Expected: the second `Gebühren` create is rejected by the current global label check.

- [ ] **Step 3: Implement parent-scoped duplicate validation**

In `CatalogEntriesView.post` and `CatalogEntryView.post`, compare both `label.casefold()` and `parent_id`. Exclude the edited object from the update comparison. Generate new IDs with the normalized parent ID, and retain the existing ID on update. Keep the parent validation and nested-parent rejection unchanged.

- [ ] **Step 4: Run the API tests to verify they pass**

Run:

```bash
python3 -m unittest tests.test_pets.PetApiTests -v
```

Expected: catalog creation, rename, archive, parent preservation, same-parent rejection, and cross-parent duplicate labels all pass.

- [ ] **Step 5: Commit the task**

```bash
git add custom_components/finanzplaner/http.py tests/test_pets.py
git commit -m "feat: allow repeated child labels across parents"
```

### Task 3: Statistik-Gruppierung und Breakdown-Quellen

**Files:**
- Modify: `custom_components/finanzplaner/core.py:1777-2055,2188-2265`
- Modify: `custom_components/finanzplaner/http.py:1000-1075`
- Test: `tests/test_finanzplaner_core.py:330-430`
- Test: `tests/test_overview_breakdown.py:75-300`

**Interfaces:**
- `overview_comparison(data, month, *, today=None, category_grouping="structure") -> dict[str, list[dict[str, object]]]`.
- `overview_breakdown(data, month, dimension, key, *, category_grouping="structure") -> dict[str, object]`.
- HTTP overview and breakdown accept `category_grouping=structure|name`, defaulting to `structure` and rejecting other values.
- Category name-mode breakdowns contain `source_categories: [{"key": ..., "name": ...}]`.

- [ ] **Step 1: Write the failing core tests**

Add a fixture with `Haus → Gebühren` and `Bank → Gebühren`, one monthly plan item and one September booking per child. Assert that:

```python
structure = core.overview_comparison(data, "2026-09", category_grouping="structure")
combined = core.overview_comparison(data, "2026-09", category_grouping="name")
self.assertEqual(len(structure["categories"]), 2)
self.assertEqual(combined["categories"][0]["key"], "category-name:gebühren")
self.assertEqual(combined["categories"][0]["name"], "Gebühren")
self.assertEqual(combined["categories"][0]["actual"], -50.0)
self.assertEqual(
    {source["name"] for source in core.overview_breakdown(
        data, "2026-09", "categories", "category-name:gebühren", category_grouping="name"
    )["source_categories"]},
    {"Haus → Gebühren", "Bank → Gebühren"},
)
```

- [ ] **Step 2: Run the core tests to verify they fail**

Run:

```bash
python3 -m unittest tests.test_finanzplaner_core tests.test_overview_breakdown -v
```

Expected: `overview_comparison` rejects the new keyword or returns two ID-based rows, and `overview_breakdown` cannot resolve the name-mode key.

- [ ] **Step 3: Implement explicit grouping in the domain core**

Validate `category_grouping` against `{"structure", "name"}`. Keep areas and projects ID-based. For categories in `name` mode, use `category-name:{label.casefold()}` as the group key and the current category snapshot as the display name. Resolve both plan-item and allocation category labels through the same grouping helper. For a name-mode breakdown, collect all matching category IDs, return all matching plans and booking allocation remainders, and add sorted `source_categories` with full parent paths. Keep the unassigned category behavior unchanged.

- [ ] **Step 4: Add failing HTTP parameter tests**

Extend `OverviewBreakdownViewTests` with:

```python
response = asyncio.run(
    self.http.OverviewBreakdownView().get(
        self._request({
            "month": "2026-09",
            "dimension": "categories",
            "key": "category-name:gebühren",
            "category_grouping": "name",
        })
    )
)
self.assertEqual(response["source_categories"], [{"key": "category-food", "name": "Futter"}])
with self.assertRaises(self.bad_request):
    asyncio.run(
        self.http.OverviewBreakdownView().get(
            self._request({
                "month": "2026-09",
                "dimension": "categories",
                "key": "category-food",
                "category_grouping": "invalid",
            })
        )
    )
```

Also assert that the overview endpoint passes `category_grouping=name` into its comparison result.

- [ ] **Step 5: Run the HTTP tests to verify they fail**

Run:

```bash
python3 -m unittest tests.test_overview_breakdown.OverviewBreakdownViewTests -v
```

Expected: the query parameter is ignored or the invalid value is accepted before the implementation.

- [ ] **Step 6: Implement HTTP propagation and validation**

Add one small parser for the query parameter in `http.py`, use it in `OverviewView.get` and `OverviewBreakdownView.get`, and pass the result to the new core signatures. Keep the default absent parameter as `structure`.

- [ ] **Step 7: Run all focused backend tests**

Run:

```bash
python3 -m unittest tests.test_finanzplaner_core tests.test_overview_breakdown tests.test_pets -v
```

Expected: all focused backend tests pass.

- [ ] **Step 8: Commit the task**

```bash
git add custom_components/finanzplaner/core.py custom_components/finanzplaner/http.py tests/test_finanzplaner_core.py tests/test_overview_breakdown.py
git commit -m "feat: group category statistics by name"
```

### Task 4: Saubere Kategoriepfade und Gruppierungsumschalter im Panel

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel-utils.mjs:1-30`
- Modify: `custom_components/finanzplaner/frontend/panel.js:1228-1455,2517-2558,4105-4170,4717-4725`
- Test: `custom_components/finanzplaner/frontend/panel-utils.test.mjs:760-940`

**Interfaces:**
- `breakdownRequestUrl(baseUrl, month, dimension, key, categoryGrouping = "structure")` includes `category_grouping` only for categories.
- Panel state uses `_comparisonCategoryGrouping`, defaulting to `structure`.
- A single category-path formatter renders `Haus → Gebühren` in options, catalog overview, rules, filters, allocations, and breakdown source lists.

- [ ] **Step 1: Write the failing frontend tests**

Add URL assertions for `category_grouping=name`, assert that panel source no longer contains `Unterkategorie ·`, and add a `comparisonTestPanel` case whose catalog data renders `Haus → Gebühren`. Assert that category grouping controls are present only when the category dimension is active and that a name-mode breakdown renders both source paths.

- [ ] **Step 2: Run the frontend tests to verify they fail**

Run:

```bash
node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs
```

Expected: the URL has no grouping parameter, the old prefix is still present, and no grouping control/source-path markup exists.

- [ ] **Step 3: Implement the shared display and request helpers**

Replace each `Unterkategorie ·` expression with a formatter that resolves `parent_id` against the category catalog and joins one parent and child with ` → `. Preserve the selected opaque ID and the historical snapshot in `data-catalog-label`. Extend `breakdownRequestUrl` and the overview request builder to carry the selected category grouping.

- [ ] **Step 4: Implement the grouping interaction**

Add a native `fieldset` with two labeled buttons or equivalent existing native controls under the category dimension. Add `_setComparisonCategoryGrouping`, clear the current breakdown on change, reload the overview, and include the active grouping in breakdown requests. Reset to `structure` when switching to areas or projects. Render `source_categories` above the detail tables with accessible text.

- [ ] **Step 5: Run frontend tests and syntax checks**

Run:

```bash
node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs
node --check custom_components/finanzplaner/frontend/panel.js
node --check custom_components/finanzplaner/frontend/panel-utils.mjs
```

Expected: all frontend tests pass and both JavaScript files parse successfully.

- [ ] **Step 6: Run the Impeccable detector**

Run:

```bash
/home/eggerd/.agents/skills/impeccable/scripts/impeccable detect --json --target custom_components/finanzplaner/frontend/panel.js
```

Expected: no new actionable findings for the changed UI surface. Fix any mechanical finding before continuing.

- [ ] **Step 7: Commit the task**

```bash
git add custom_components/finanzplaner/frontend/panel.js custom_components/finanzplaner/frontend/panel-utils.mjs custom_components/finanzplaner/frontend/panel-utils.test.mjs
git commit -m "feat: clarify category paths in panel"
```

### Task 5: Dokumentation und Gesamtprüfung

**Files:**
- Modify: `README.md:20-75`
- Modify: `CHANGELOG.md:8-18`
- Test: all existing Python and frontend tests

- [ ] **Step 1: Update product-facing documentation**

Document that the same subcategory name can exist under different parent categories, that selection fields show the full path, and that the category comparison offers `Struktur` and `Name zusammenfassen`. Add an `Unreleased` changelog section with normal Markdown line breaks and bullets; do not change the version number.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q custom_components tests
node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs
git diff --check
```

Expected: Python and Node tests exit successfully, compilation emits no errors, and `git diff --check` reports no whitespace errors. If Node is unavailable, report that exact limitation and retain the static source checks.

- [ ] **Step 3: Review the requirement checklist**

Verify in the final diff that existing category IDs are preserved, same-parent duplicates are rejected, different-parent duplicates are allowed, both statistical modes combine the correct amounts, full paths replace the old prefix everywhere, and the default request remains structural.

- [ ] **Step 4: Commit documentation and final changes**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document reusable subcategories"
```
