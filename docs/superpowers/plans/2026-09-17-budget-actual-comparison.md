# Budget-Ist-Vergleich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Finanzübersicht zeigt Plan, Prognose, Ist und Abweichungen je Bereich, Kategorie und Projekt und öffnet die zugehörigen Monatsdetails.

**Architecture:** Der dependency-freie Domain-Core berechnet eine neue, rein lesende Vergleichsprojektion aus Planposten, Futterprognosen und Buchungsaufteilungen. Ein authentifizierter HTTP-Endpunkt liefert die Detaildatensätze; das native Panel stellt die Projektion als umschaltbare semantische Tabelle mit Inline-Details dar. Bestehende Übersichtsschlüssel und HA-Sensorverträge bleiben unverändert.

**Tech Stack:** Python 3 Standardbibliothek, Home-Assistant `HomeAssistantView`, persistenter lokaler Store, native Web Component, ES-Module, Node-Test-Runner und Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-09-17-budget-actual-comparison-design.md`

## Global Constraints

- Der Store erhöht seine Version nicht.
- `overview_values` und bestehende Felder von `overview_details` bleiben abwärtskompatibel.
- Planwerte verwenden weiterhin `plan_item_month_values`; Einnahmen bleiben positiv, Ausgaben und Rücklagen negativ.
- `__unassigned__` bezeichnet fehlende Bereichs-, Kategorie- oder Projektzuordnungen.
- Der Vergleich verändert beim Lesen weder Store-Daten noch Buchungen.
- Der Breakdown-Endpunkt bleibt authentifiziert und maskiert Kontoreferenzen an der Response-Grenze.
- Es wird keine externe Frontend-Abhängigkeit und keine Chart-Bibliothek ergänzt.
- Frontend-Arbeit folgt `$impeccable` im Modus `Operate`; semantische Tabellen, sichtbarer Fokus sowie Lade-, Fehler- und Leerzustände sind Pflicht.
- Jede Produktionsänderung entsteht nach einem zuerst fehlschlagenden Test.
- Vor der Übergabe laufen Python-Tests, Node-Tests, Syntaxprüfung, `compileall`, `git diff --check` und der Impeccable-Detector.

---

### Task 1: Vergleichsprojektion im Domain-Core

**Files:**
- Modify: `custom_components/finanzplaner/core.py:1450-1750`
- Modify: `tests/test_finanzplaner_core.py:120-220`
- Modify: `custom_components/finanzplaner/http.py:825-845`
- Modify: `tests/test_account_import.py:448-465`

**Interfaces:**
- Consumes: vorhandene Store-Daten, `plan_item_month_values`, Kataloge, Buchungsaufteilungen und optionale `today`-Referenz.
- Produces: `overview_comparison(data, month, *, today=None) -> dict[str, list[dict[str, object]]]` und ein zusätzliches `comparison`-Feld in `overview_details`.

- [ ] **Step 1: Schreibe die fehlschlagenden Domain-Tests.**

  Ergänze in `ForecastTests` einen Test mit einem Bereich, einer Kategorie und
  einem Projekt. Der Planposten liefert `plan=-100` und `scheduled=-100`; eine
  `-30`-Buchung wird auf alle drei Dimensionen aufgeteilt. Prüfe `plan`,
  `actual`, `forecast`, `variance`, `forecast_variance`, `key` und den
  Prozentwert. Ergänze einen zweiten Test für `__unassigned__` und eine
  Katalog-ID mit historischem Snapshot.

- [ ] **Step 2: Führe nur die neuen Tests aus und bestätige RED.**

  Run: `python3 -m unittest tests.test_finanzplaner_core.ForecastTests.test_overview_comparison_exposes_plan_forecast_actual_and_variances tests.test_finanzplaner_core.ForecastTests.test_overview_comparison_keeps_unassigned_values_and_catalog_keys -v`

  Expected: FAIL mit `AttributeError`, weil `overview_comparison` noch nicht
  exportiert ist.

- [ ] **Step 3: Implementiere die minimale Vergleichsprojektion.**

  Ergänze in `core.py` einen kleinen Dimensions-Mapper für `areas`,
  `categories` und `projects`, der aktuelle Kataloglabels über die ID und
  danach den Snapshot auflöst. Aggregiere Plan und erwarteten Cashflow aus
  aktiven Planposten. Aggregiere Ist aus den Allocation-Beträgen mit dem
  Vorzeichen der Buchung und schreibe Restbeträge in `__unassigned__`. Füge
  Futterprognosen als erwarteten Cashflow zur unzugeordneten Gruppe hinzu.
  Serialisiere pro Gruppe die oben in der Spezifikation definierte Struktur und
  berechne `variance_percent` nur bei einem von null verschiedenen Planwert.
  Sortiere deterministisch nach dem größten absoluten Wert und danach nach
  Name; begrenze die Ausgabe auf zwölf Einträge je Dimension.

  Rufe die Funktion aus `overview_details` auf und lasse die bisherigen
  `areas`- und `categories`-Felder unverändert. Ergänze im HTTP-Test die
  Erwartung, dass die Overview-Antwort `comparison.projects` enthält.

- [ ] **Step 4: Führe die fokussierten Tests aus und bestätige GREEN.**

  Run: `python3 -m unittest tests.test_finanzplaner_core.ForecastTests tests.test_account_import.BankImportViewTests.test_import_assign_and_overview_form_one_live_workflow -v`

  Expected: PASS.

- [ ] **Step 5: Committe den Domain-Schritt.**

  Run: `git add custom_components/finanzplaner/core.py custom_components/finanzplaner/http.py tests/test_finanzplaner_core.py tests/test_account_import.py && git commit -m "feat: add budget actual comparison projection"`

### Task 2: Authentifizierter Breakdown-Endpunkt

**Files:**
- Modify: `custom_components/finanzplaner/core.py:1450-1750`
- Modify: `custom_components/finanzplaner/http.py:825-875`
- Modify: `custom_components/finanzplaner/__init__.py:20-85`
- Modify: `tests/test_rule_payloads.py` oder Create: `tests/test_overview_breakdown.py`

**Interfaces:**
- Consumes: `overview_comparison`, `dimension`, `key` und `month`.
- Produces: `overview_breakdown(data, month, dimension, key) -> dict[str, object]` und `OverviewBreakdownView` unter `/api/finanzplaner/overview/breakdown`.

- [ ] **Step 1: Schreibe die fehlschlagenden HTTP- und Domain-Tests.**

  Lege `tests/test_overview_breakdown.py` an. Teste, dass die Detailprojektion
  einen passenden aktiven Planposten und eine passende Buchung inklusive
  `matched_amount` zurückgibt, Monatsfremdes ausschließt und bei
  `__unassigned__` den nicht aufgeteilten Restbetrag liefert. Teste den View
  mit einer nicht authentifizierten Anfrage, einer ungültigen Dimension, einer
  gültigen Anfrage und einer internen vollständigen Kontoreferenz; die
  Response darf nur die maskierte Referenz enthalten und der Store muss vor und
  nach dem GET bytegleich sein.

- [ ] **Step 2: Führe die neuen Tests aus und bestätige RED.**

  Run: `python3 -m unittest tests.test_overview_breakdown -v`

  Expected: FAIL mit `ImportError` oder `AttributeError`, weil die
  Breakdown-Projektion und `OverviewBreakdownView` noch fehlen.

- [ ] **Step 3: Implementiere Domain-Detailprojektion und View.**

  Ergänze eine reine Funktion, die zuerst die erlaubte Dimension normalisiert,
  den Vergleichseintrag zum Namen auflöst und anschließend aktive Planposten
  mit einem Beitrag in diesem Monat sowie Buchungen mit einem positiven
  `matched_amount` auswählt. Buchungen werden als Kopie mit den bestehenden
  Feldern und `matched_amount` ausgegeben; `account` und
  `account_reference` bleiben der vorhandenen `_response_payload`-Grenze
  unterstellt.

  Ergänze `OverviewBreakdownView.get`: `month` erhält denselben
  `YYYY-MM`-Vertrag wie `OverviewView`, `dimension` muss einer der drei
  Katalogschlüssel sein, `key` darf nicht leer sein. Der View ruft die reine
  Funktion auf, serialisiert Planposten mit `plan_item_payload`, bereitet
  Buchungen aus Dictionaries auf und gibt eine authentifizierte JSON-Antwort
  zurück. Registriere den View in `async_setup`.

- [ ] **Step 4: Führe die fokussierten Tests und die bestehenden HTTP-Tests aus.**

  Run: `python3 -m unittest tests.test_overview_breakdown tests.test_account_import.BankImportViewTests.test_import_assign_and_overview_form_one_live_workflow -v`

  Expected: PASS.

- [ ] **Step 5: Committe den API-Schritt.**

  Run: `git add custom_components/finanzplaner/core.py custom_components/finanzplaner/http.py custom_components/finanzplaner/__init__.py tests/test_overview_breakdown.py && git commit -m "feat: expose overview breakdown details"`

### Task 3: Vergleichstabelle und Inline-Details im Panel

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel.js:1-3400`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.mjs:1-260`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.test.mjs:1-560`

**Interfaces:**
- Consumes: `data.comparison`, `/api/finanzplaner/overview/breakdown`,
  `formatEuro`, `readApiResponse` und `fetchWithHomeAssistantAuth`.
- Produces: `comparisonDimensionLabel`, `comparisonEntries`,
  `breakdownRequestUrl` und die UI-Zustände für Auswahl, Laden, Fehler, leer
  und erfolgreich geladene Details.

- [ ] **Step 1: Schreibe die fehlschlagenden Frontend-Tests.**

  Ergänze Tests für die Dimensionslabels und die URL-Kodierung von Monat,
  Dimension und Schlüssel. Prüfe außerdem am Panel-Quelltext, dass die
  Übersichtsansicht eine Tabelle mit `Plan`, `Prognose`, `Ist` und
  `Abweichung`, drei native Dimensionsbuttons, eine Detailaktion und die
  `aria-live`-Zustände enthält. Ergänze einen Verhaltentest mit einem kleinen
  Test-Panel, das `fetchWithAuth` für den Breakdown-Endpunkt aufruft und nach
  Erfolg die geladenen Details rendert.

- [ ] **Step 2: Führe die neuen Node-Tests aus und bestätige RED.**

  Run: `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs`

  Expected: FAIL, weil die neuen Hilfsfunktionen und das Vergleichsmarkup noch
  nicht existieren.

- [ ] **Step 3: Implementiere die Panel-Zustände und Hilfsfunktionen.**

  Ergänze die Konstante `BREAKDOWN_URL`, importiere die neuen testbaren
  Hilfsfunktionen und initialisiere im Panel die aktive Dimension mit
  `categories`, die geladene Auswahl mit `null` sowie Loading- und
  Fehlerzustand. `dataWithDefaults` übernimmt `comparison` aus der API und
  erzeugt für Demo-Daten eine kleine Projektion aus den vorhandenen Area- und
  Category-Werten.

  Rendere unter dem Monatsverlauf einen einzelnen Abschnitt
  „Budget-Ist-Vergleich“. Die Dimensionsbuttons verwenden `aria-pressed` und
  bleiben echte Buttons. Die Tabelle erhält Caption, `scope`-Attribute,
  Zeilenüberschriften und sichtbare Spalten für Plan, Prognose, Ist,
  Abweichung und Details. Abweichungen erscheinen zusätzlich als Textstatus;
  Farbe bleibt nur sekundäre Unterstützung. Zeige bei fehlenden Einträgen
  eine erklärende leere Ansicht.

  Ergänze `_loadBreakdown(dimension, key)`: Request mit
  `fetchWithHomeAssistantAuth`, Fehler über den bestehenden
  Feedbackmechanismus, Ergebnis nur übernehmen, wenn Ansicht und Auswahl noch
  aktuell sind. Die Inline-Details zeigen je eine semantische Tabelle für
  Planposten und Buchungen sowie „Vergleich schließen“ und „Erneut laden“.
  Binde alle Buttons nach jedem Render an und lösche Detaildaten beim
  Monatswechsel oder beim Dimensionswechsel.

- [ ] **Step 4: Führe Node-Tests, Syntaxprüfung und den Impeccable-Detector aus.**

  Run: `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs && node --check custom_components/finanzplaner/frontend/panel.js && sh /home/eggerd/.agents/skills/impeccable/scripts/impeccable detect --json custom_components/finanzplaner/frontend/panel.js custom_components/finanzplaner/frontend/panel-utils.mjs`

  Expected: PASS, keine unbehandelten Detector-Befunde.

- [ ] **Step 5: Committe den Panel-Schritt.**

  Run: `git add custom_components/finanzplaner/frontend/panel.js custom_components/finanzplaner/frontend/panel-utils.mjs custom_components/finanzplaner/frontend/panel-utils.test.mjs && git commit -m "feat: add budget actual comparison to overview"`

### Task 4: Dokumentation und Abschlussprüfung

**Files:**
- Modify: `README.md:10-30`
- Modify: `CHANGELOG.md:9-16`

**Interfaces:**
- Consumes: gelieferte Vergleichsprojektion, Breakdown-Endpunkt und Panel-Interaktion.
- Produces: aktuelle Nutzerbeschreibung und Unreleased-Eintrag ohne Versionsbump.

- [ ] **Step 1: Ergänze die Dokumentation.**

  Beschreibe in README den Budget-Ist-Vergleich, die drei Dimensionen und die
  Inline-Details. Ergänze unter `Unreleased` einen Eintrag; ändere Manifest,
  Version und Git-Tag nicht.

- [ ] **Step 2: Führe die vollständige Prüfung aus.**

  Run: `python3 -m unittest discover -s tests -v && node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs && node --check custom_components/finanzplaner/frontend/panel.js && python3 -m compileall -q custom_components && git diff --check`

  Expected: alle Tests PASS, Syntaxprüfung und `compileall` mit Exit 0 sowie
  keine Whitespace-Fehler.

- [ ] **Step 3: Committe Dokumentation und Abschluss.**

  Run: `git add README.md CHANGELOG.md && git commit -m "docs: document budget actual comparison"`
