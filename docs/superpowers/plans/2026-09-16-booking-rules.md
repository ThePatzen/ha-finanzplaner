# Buchungsregeln und Zuordnungsvorschläge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Finanzplaner erzeugt aus gespeicherten Regeln transparente, bestätigungspflichtige Aufteilungsvorschläge für ungeklärte Buchungen.

**Architecture:** Die reine Regelprüfung und die Cent-Materialisierung liegen im bestehenden Python-Domain-Core. Authentifizierte HTTP-Views verwalten Regeln und projizieren Vorschläge auf die Prüfliste, ohne den Store beim Lesen zu verändern. Das native Panel erhält eine Regelverwaltung, einen Vorschlagszustand im bestehenden Aufteilungseditor und eine Aktion zum Erstellen einer Regel aus einer bestätigten Buchung.

**Tech Stack:** Python 3 Standardbibliothek, Home-Assistant `HomeAssistantView` und `Store`, native JavaScript-Oberfläche, ES-Module, Node-Test-Runner, `unittest`.

**Spec:** `docs/superpowers/specs/2026-09-16-booking-rules-design.md`

## Global Constraints

- Regeln speichern Konto, Zahlungsempfänger, optionalen Verwendungszweckfilter, Priorität und eine prozentuale Aufteilungsvorlage.
- Ein Vorschlag wird nie ohne ausdrückliche Nutzerbestätigung als Buchungsaufteilung gespeichert.
- Die Regelprüfung verwendet exakte normalisierte Zahlungsempfänger, optionale Verwendungszweck-Teilstrings und Konto-IDs; sie verwendet keine Ähnlichkeitswerte oder externen Bibliotheken.
- Bei gleich priorisierten Treffern mit der höchsten Priorität bleibt die Buchung ungeklärt und erhält einen Konfliktstatus.
- Prozentwerte werden in positive Cent-Beträge umgerechnet; den Rundungsrest erhält die erste gespeicherte Aufteilungszeile.
- Der Abruf der Prüfliste darf den Store nicht verändern.
- Bestehende `resolved`-Buchungen und ihre historischen Snapshots bleiben bei Regeländerungen unverändert.
- Alle Regel- und Buchungsendpunkte bleiben authentifiziert und maskieren IBANs beziehungsweise Kontoangaben an der API-Grenze.
- Der Store behält seine aktuelle Hauptversion; Manifest, Version und Git-Tag ändern sich erst nach ausdrücklicher Versionsfreigabe.
- Frontend-Arbeit folgt `$impeccable` im Modus `Operate`; vor Markup- oder Client-JavaScript-Änderungen muss der Impeccable-Kontext erfolgreich geladen sein.
- `modern-web-guidance` wird vor dem ersten Frontend-Edit gesucht und die relevanten Guides werden in die Umsetzung einbezogen.
- Jeder Produktionscode entsteht nach einem zuerst fehlgeschlagenen Test; jeder Task endet mit einem fokussierten Testlauf.

---

### Task 1: Regelvalidierung und Matching im Domain-Core

**Files:**
- Modify: `custom_components/finanzplaner/core.py`
- Create: `tests/test_rules.py`

**Interfaces:**
- Consumes: gespeicherte Regel-Dictionaries, Buchungs-Dictionaries, aktuelle Ziel-/Katalog-/Tier-Referenzen sowie bestehende `parse_allocation_payload`-Semantik.
- Produces: `validate_rule_payload(payload, *, valid_targets, accounts, catalogs, pets, partial=False) -> dict[str, object]`, `rule_suggestion(booking, rules, *, accounts, valid_targets, catalogs, pets) -> dict[str, object]` und `rule_payload_from_booking(booking) -> dict[str, object]`.

`validate_rule_payload` gibt normalisierte, speicherbare Werte zurück. Die
Ausgabe enthält `label`, `active`, `priority`, `account_id`, `counterparty`,
`purpose_contains` und `allocations`. Jede Allocation enthält `target`,
`share_percent`, `area_id`, `category_id`, `project_id` und `pet_id`.

`rule_suggestion` gibt immer eine Projektion mit dieser Form zurück:

```python
{
    "status": "unresolved" | "suggested" | "conflict",
    "suggestion": {
        "rule_id": str,
        "rule_label": str,
        "reason": str,
        "allocations": list[dict[str, object]],
    } | None,
    "conflicts": list[str],
}
```

Bei `suggested` enthält jede materialisierte Allocation positive `amount`-Centwerte
und dieselben Referenzfelder wie eine manuell gespeicherte Buchungsaufteilung.

- [ ] **Step 1: Schreibe den ersten fehlschlagenden Test für eine gültige Regel und einen eindeutigen Treffer.**

```python
def test_exact_counterparty_and_account_create_one_suggestion(self):
    core = load_core()
    rules = [{
        "id": "rule-grocery",
        "label": "Supermarkt Haushalt",
        "active": True,
        "priority": 100,
        "account_id": "account-giro",
        "counterparty": "Supermarkt AG",
        "purpose_contains": None,
        "allocations": [{
            "target": "household",
            "share_percent": 100.0,
            "area_id": None,
            "category_id": "category-food",
            "project_id": None,
            "pet_id": None,
        }],
    }]
    booking = {
        "account_id": "account-giro",
        "counterparty": "  supermarkt ag ",
        "purpose": "Einkauf",
        "amount": -42.37,
    }

    result = core.rule_suggestion(
        booking,
        rules,
        accounts={"account-giro": {"label": "Giro"}},
        valid_targets={"household"},
        catalogs={
            "categories": [{"id": "category-food", "active": True}],
            "areas": [],
            "projects": [],
        },
        pets={},
    )

    self.assertEqual(result["status"], "suggested")
    self.assertEqual(result["suggestion"]["allocations"][0]["amount"], 42.37)
```

- [ ] **Step 2: Führe nur den neuen Test aus und bestätige den korrekten RED-Fehler.**

Run: `python3 -m unittest tests.test_rules.RuleMatchingTests.test_exact_counterparty_and_account_create_one_suggestion -v`

Expected: FAIL, weil `rule_suggestion` noch nicht existiert.

- [ ] **Step 3: Implementiere Normalisierung, Regelvalidierung und den eindeutigen Einzeltreffer minimal.**

Implementiere in `core.py`:

```python
def validate_rule_payload(
    payload: object,
    *,
    valid_targets: set[str],
    accounts: dict[str, dict[str, object]],
    catalogs: dict[str, list[dict[str, object]]],
    pets: dict[str, dict[str, object]],
    partial: bool = False,
) -> dict[str, object]:
    pass

def rule_suggestion(
    booking: dict[str, object],
    rules: list[dict[str, object]],
    *,
    accounts: dict[str, dict[str, object]],
    valid_targets: set[str],
    catalogs: dict[str, list[dict[str, object]]],
    pets: dict[str, dict[str, object]],
) -> dict[str, object]:
    pass

def rule_payload_from_booking(booking: dict[str, object]) -> dict[str, object]:
    pass
```

Verwende `casefold()`, trimme Text und fasse Leerzeichen für die Matching-
Felder zusammen. Prüfe `counterparty` exakt, wende `purpose_contains` als
normalisierten Teilstring an und akzeptiere eine leere `account_id` als
Kontowildcard. Prüfe Referenzen gegen die übergebenen aktuellen Daten.

- [ ] **Step 4: Führe den ersten Test aus und bestätige GREEN.**

Run: `python3 -m unittest tests.test_rules.RuleMatchingTests.test_exact_counterparty_and_account_create_one_suggestion -v`

Expected: PASS.

- [ ] **Step 5: Ergänze fehlschlagende Tests für Priorität, Konflikt und Filter.**

```python
class RuleMatchingTests(unittest.TestCase):
    def _rule(self, rule_id, *, priority=100, active=True,
              account_id="account-giro", purpose_contains=None,
              allocations=None):
        return {
            "id": rule_id,
            "label": rule_id,
            "active": active,
            "priority": priority,
            "account_id": account_id,
            "counterparty": "Supermarkt AG",
            "purpose_contains": purpose_contains,
            "allocations": allocations or [{
                "target": "household",
                "share_percent": 100.0,
                "area_id": None,
                "category_id": None,
                "project_id": None,
                "pet_id": None,
            }],
        }

    def _suggestion(self, rules, purpose="Einkauf", account_id="account-giro"):
        return load_core().rule_suggestion(
            {
                "account_id": account_id,
                "counterparty": "Supermarkt AG",
                "purpose": purpose,
                "amount": -42.37,
            },
            rules,
            accounts={"account-giro": {"label": "Giro"}},
            valid_targets={"household"},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

    def test_highest_priority_rule_wins(self):
        result = self._suggestion([
            self._rule("rule-low", priority=10),
            self._rule("rule-high", priority=20),
        ])
        self.assertEqual(result["status"], "suggested")
        self.assertEqual(result["suggestion"]["rule_id"], "rule-high")

    def test_equal_highest_priority_rules_create_conflict(self):
        result = self._suggestion([
            self._rule("rule-a", priority=20),
            self._rule("rule-b", priority=20),
        ])
        self.assertEqual(result["status"], "conflict")
        self.assertEqual(result["conflicts"], ["rule-a", "rule-b"])

    def test_purpose_filter_rejects_nonmatching_booking(self):
        result = self._suggestion([
            self._rule("rule-purpose", purpose_contains="monat")
        ])
        self.assertEqual(result["status"], "unresolved")

    def test_disabled_rule_is_ignored(self):
        result = self._suggestion([
            self._rule("rule-disabled", active=False)
        ])
        self.assertEqual(result["status"], "unresolved")

    def test_account_mismatch_is_ignored(self):
        result = self._suggestion([
            self._rule("rule-other-account", account_id="account-other")
        ])
        self.assertEqual(result["status"], "unresolved")
```

Jeder Test prüft den Rückgabestatus und stellt sicher, dass die Engine keine
Buchung oder Regelliste mutiert.

- [ ] **Step 6: Implementiere Prioritätsauswahl, Konfliktstatus und Filter.**

Filtere zuerst aktive Regeln. Sortiere nur nach `priority` absteigend und
verwende die stabile Regel-ID aufsteigend als deterministische Reihenfolge.
Liegen mehrere Treffer auf der höchsten Prioritätsstufe, gib `conflict` und
alle Regel-IDs in `conflicts` zurück. Wähle keine Regel stillschweigend.

- [ ] **Step 7: Führe die fokussierten Core-Tests aus.**

Run: `python3 -m unittest tests.test_rules -v`

Expected: PASS.

- [ ] **Step 8: Ergänze fehlschlagende Tests für Prozentmaterialisierung und Validierungsfehler.**

```python
def test_percentage_materialization_assigns_rounding_remainder_to_first_row(self):
    core = load_core()
    allocations = [
        {"target": "household", "share_percent": 33.33,
         "area_id": None, "category_id": None, "project_id": None,
         "pet_id": None},
        {"target": "household", "share_percent": 33.33,
         "area_id": None, "category_id": None, "project_id": None,
         "pet_id": None},
        {"target": "household", "share_percent": 33.34,
         "area_id": None, "category_id": None, "project_id": None,
         "pet_id": None},
    ]
    result = core.rule_suggestion(
        {"account_id": "account-giro", "counterparty": "Supermarkt AG",
         "purpose": "Einkauf", "amount": -100.00},
        [RuleMatchingTests()._rule("rule-split", allocations=allocations)],
        accounts={"account-giro": {"label": "Giro"}},
        valid_targets={"household"},
        catalogs={"categories": [], "areas": [], "projects": []},
        pets={},
    )
    self.assertEqual(
        [row["amount"] for row in result["suggestion"]["allocations"]],
        [33.34, 33.33, 33.33],
    )

def test_rule_rejects_share_sum_other_than_one_hundred(self):
    core = load_core()
    rule = RuleMatchingTests()._rule("rule-invalid")
    rule["allocations"][0]["share_percent"] = 99.99
    with self.assertRaises(ValueError):
        core.validate_rule_payload(
            rule,
            valid_targets={"household"},
            accounts={"account-giro": {"active": True}},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

def test_rule_rejects_unknown_target_and_archived_catalog(self):
    core = load_core()
    rule = RuleMatchingTests()._rule("rule-invalid")
    rule["allocations"][0]["target"] = "person.unknown"
    with self.assertRaises(ValueError):
        core.validate_rule_payload(
            rule,
            valid_targets={"household"},
            accounts={"account-giro": {"active": True}},
            catalogs={"categories": [], "areas": [], "projects": []},
            pets={},
        )

def test_rule_payload_from_booking_preserves_allocation_metadata(self):
    core = load_core()
    payload = core.rule_payload_from_booking({
        "account_id": "account-giro",
        "counterparty": "Supermarkt AG",
        "allocations": [{
            "target": "household", "amount": 42.37,
            "area_id": "area-food", "category_id": "category-food",
            "project_id": None, "pet_id": None,
        }],
    })
    self.assertEqual(payload["account_id"], "account-giro")
    self.assertEqual(payload["allocations"][0]["category_id"], "category-food")
    self.assertEqual(sum(row["share_percent"] for row in payload["allocations"]), 100.0)
```

Der Rundungstest verwendet `100.00` und Anteile `33.33`, `33.33`, `33.34`
beziehungsweise einen Betrag, der einen Restcent erzeugt. Die Summe der
resultierenden positiven Beträge muss exakt dem absoluten Buchungsbetrag
entsprechen.

- [ ] **Step 9: Implementiere Centmaterialisierung und Regelvorlage aus Buchungen.**

Nutze `Decimal` und `ROUND_HALF_UP`. Runde die prozentualen Zeilen auf Cent,
berechne die Differenz zur absoluten Buchungssumme und addiere sie zur ersten
Zeile. `rule_payload_from_booking` übernimmt Konto, Zahlungsempfänger und die
bestätigten Referenzfelder. Es setzt den Verwendungszweckfilter leer und
wandelt die bestehenden Allocation-Beträge in Prozentwerte um.

- [ ] **Step 10: Führe alle Core-Tests und die bestehende Testbasis aus.**

Run: `python3 -m unittest tests.test_rules tests.test_finanzplaner_core -v`

Expected: PASS.

- [ ] **Step 11: Committe den abgeschlossenen Core-Schritt.**

```bash
git add custom_components/finanzplaner/core.py tests/test_rules.py
git commit -m "feat: add booking rule matching core"
```

---

### Task 2: Regel-Store und authentifizierte Regel-API

**Files:**
- Modify: `custom_components/finanzplaner/storage.py`
- Modify: `custom_components/finanzplaner/http.py`
- Modify: `custom_components/finanzplaner/__init__.py`
- Create: `tests/test_rule_payloads.py`

**Interfaces:**
- Consumes: `validate_rule_payload` und `rule_payload_from_booking` aus Task 1 sowie die bestehenden Konten-, Katalog-, Tier- und Personenstrukturen.
- Produces: `rule_payload(rule) -> dict[str, object]`, `RulesView`, `RuleView` und `RuleFromBookingView`.

Die Endpunkte lauten:

```text
GET  /api/finanzplaner/rules
POST /api/finanzplaner/rules
POST /api/finanzplaner/rules/{rule_id}
POST /api/finanzplaner/rules/from-booking/{booking_id}
```

- [ ] **Step 1: Schreibe den fehlschlagenden Test für die Store-Normalisierung.**

```python
def test_current_store_adds_empty_rules_without_changing_bookings(self):
    data = storage.normalize_current_store_data(
        {"version": storage.STORAGE_VERSION, "bookings": [{"id": "booking-1"}]},
        "Testhaushalt",
    )
    self.assertEqual(data["rules"], [])
    self.assertEqual(data["bookings"][0]["id"], "booking-1")
```

- [ ] **Step 2: Führe den Test aus und bestätige RED.**

Run: `python3 -m unittest tests.test_rule_payloads.RuleStorageTests.test_current_store_adds_empty_rules_without_changing_bookings -v`

Expected: FAIL, wenn `rules` in der Normalisierung nicht garantiert wird.

- [ ] **Step 3: Implementiere die nicht-destruktive `rules`-Normalisierung.**

Ergänze in `normalize_current_store_data` und `migrate_store_data` einen
leeren Listenwert für fehlende oder nicht listenförmige `rules`. Verändere
vorhandene Regel-Dictionaries nicht stillschweigend; die API validiert sie
vor der Verwendung.

- [ ] **Step 4: Führe den Storage-Test und die Migrationsregressionen aus.**

Run: `python3 -m unittest tests.test_rule_payloads.RuleStorageTests tests.test_accounts_and_migration -v`

Expected: PASS.

- [ ] **Step 5: Schreibe fehlschlagende Authentifizierungs- und CRUD-Tests.**

```python
def test_rules_get_requires_authentication(self): ...
def test_rules_post_normalizes_and_persists_rule(self): ...
def test_rule_post_updates_only_editable_fields(self): ...
def test_invalid_rule_post_does_not_mutate_or_save(self): ...
def test_rule_archive_sets_active_false_without_deleting(self): ...
def test_from_booking_requires_resolved_booking(self): ...
def test_from_resolved_booking_creates_rule_template(self): ...
```

Die Tests verwenden dieselben kleinen Request-, Coordinator- und Home-
Assistant-State-Fakes wie die bestehenden API-Testdateien. Jeder ungültige
Request prüft `store.save_count == 0` und die Unverändertheit der Daten.

- [ ] **Step 6: Führe einen einzelnen neuen API-Test aus und bestätige RED.**

Run: `python3 -m unittest tests.test_rule_payloads.RuleViewTests.test_rules_post_normalizes_and_persists_rule -v`

Expected: FAIL, weil `RulesView` noch nicht registriert ist.

- [ ] **Step 7: Implementiere die API-Hilfsfunktionen und `RulesView`.**

Baue die gültigen Ziele aus `household` und den aktuellen `person.*`-States.
Baue Konten als ID-Map und Kataloge/Tiere aus dem Store. Validiere die
Eingabe vor jeder Store-Mutation. Erzeuge IDs über `uuid4().hex`, setze
`active=True`, `created_at` und `updated_at`, speichere und aktualisiere den
Coordinator wie die bestehenden CRUD-Views.

`rule_payload` liefert Rule-Felder, aktuelle Kontobezeichnung und nur
maskierte Kontoreferenzen. Es gibt keine vollständige IBAN zurück.

- [ ] **Step 8: Implementiere `RuleView` mit reversibler Deaktivierung.**

Suche die Regel anhand ihrer ID. Akzeptiere nur die in der Rule-Struktur
definierten editierbaren Felder. Validiere den zusammengeführten Datensatz
gegen aktuelle Ziele, Konten, Kataloge und Tiere. Setze bei Erfolg
`updated_at`, speichere und aktualisiere den Coordinator. Lösche keine Regel.

- [ ] **Step 9: Implementiere `RuleFromBookingView` und registriere alle Views.**

Akzeptiere nur gespeicherte Buchungen mit `status == "resolved"`. Erzeuge die
Vorlage über `rule_payload_from_booking`, validiere sie erneut und übernehme
das optionale vom Nutzer gelieferte Label. Leere den Verwendungszweckfilter
bei der Vorbelegung. Registriere die Views in `__init__.py` zusammen mit den
bestehenden authentifizierten Views.

- [ ] **Step 10: Führe alle Regel-API-Tests aus und prüfe GREEN.**

Run: `python3 -m unittest tests.test_rule_payloads -v`

Expected: PASS.

- [ ] **Step 11: Führe die bestehenden Konto-, Tier-, Planposten- und Migrations-Tests aus.**

Run: `python3 -m unittest tests.test_accounts_and_migration tests.test_account_payloads tests.test_allocation_payloads tests.test_pets tests.test_plan_items -v`

Expected: PASS.

- [ ] **Step 12: Committe den API-Schritt.**

```bash
git add custom_components/finanzplaner/storage.py custom_components/finanzplaner/http.py custom_components/finanzplaner/__init__.py tests/test_rule_payloads.py
git commit -m "feat: add booking rule management api"
```

---

### Task 3: Vorschläge in die Prüfliste projizieren

**Files:**
- Modify: `custom_components/finanzplaner/http.py`
- Modify: `tests/test_rule_payloads.py`

**Interfaces:**
- Consumes: `rule_suggestion` aus Task 1, `UnresolvedBookingsView` und die bestehende Response-Redaction.
- Produces: angereicherte Antworten von `GET /api/finanzplaner/bookings/unresolved` mit abgeleitetem `status`, `suggestion` und `conflicts`.

- [ ] **Step 1: Schreibe einen fehlschlagenden Projektionstest.**

```python
def test_unresolved_list_exposes_suggestion_without_mutating_store(self):
    booking = {
        "id": "booking-1",
        "status": "unresolved",
        "account_id": "account-giro",
        "counterparty": "Supermarkt AG",
        "purpose": "Einkauf",
        "amount": -42.37,
        "allocations": [],
    }
    self.coordinator.store.data["bookings"] = [booking]
    self.coordinator.store.data["rules"] = [self._rule_for_supermarket()]

    response = asyncio.run(UnresolvedBookingsView().get(self._request()))

    body = response.json()
    self.assertEqual(body["bookings"][0]["status"], "suggested")
    self.assertEqual(body["bookings"][0]["suggestion"]["rule_id"], "rule-1")
    self.assertEqual(booking["status"], "unresolved")
    self.assertEqual(booking["allocations"], [])
```

- [ ] **Step 2: Führe den Projektionstest aus und bestätige RED.**

Run: `python3 -m unittest tests.test_rule_payloads.UnresolvedRuleProjectionTests.test_unresolved_list_exposes_suggestion_without_mutating_store -v`

Expected: FAIL, weil die View bisher nur gespeicherte Statuswerte liefert.

- [ ] **Step 3: Ergänze eine reine Response-Projektion in `UnresolvedBookingsView.get`.**

Erzeuge für jede ungeklärte Buchung eine flache Kopie. Übergebe aktuelle
Konten, Ziele, Kataloge und Tiere an `rule_suggestion`. Setze ausschließlich
auf der Kopie den abgeleiteten `status`, die `suggestion` und `conflicts`.
Verwende anschließend `_response_payload`, ohne den Store zu schreiben oder
`async_refresh` aufzurufen.

- [ ] **Step 4: Ergänze Tests für Konflikte, ungültige Referenzen und resolved-Buchungen.**

```python
def test_conflicting_rules_are_visible_without_selection(self): ...
def test_invalid_rule_reference_stays_unresolved_with_reason(self): ...
def test_resolved_booking_is_not_returned_by_unresolved_view(self): ...
```

- [ ] **Step 5: Führe die fokussierten und alle Python-Tests aus.**

Run: `python3 -m unittest tests.test_rule_payloads tests.test_finanzplaner_core -v`

Run: `python3 -m unittest discover -s tests -v`

Expected: Beide Läufe bestehen.

- [ ] **Step 6: Committe die Projektion.**

```bash
git add custom_components/finanzplaner/http.py tests/test_rule_payloads.py
git commit -m "feat: expose booking rule suggestions"
```

---

### Task 4: Frontend-Datenfluss und Browser-Patterns vorbereiten

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel-utils.mjs`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.test.mjs`

**Interfaces:**
- Consumes: die API-Projektion aus Task 3 und die bestehende Draft-/Allocation-Struktur.
- Produces: kleine pure Helpers für Statusbeschriftung, Vorschlags-Draft und Rule-Form-Payload.

Vor diesem Task muss der Agent den Frontend-Kontext erneut prüfen und die
aktuelle `modern-web-guidance` befragen. Die Suche startet vor dem ersten
Client-JavaScript-Edit:

```bash
npx -y modern-web-guidance@latest search "accessible review suggestion actions and validated forms in a native JavaScript app" --skill-version 2026_05_16-c5e7870
```

Rufe mindestens die Treffer für Formular-Fehler, deklarative Button-Aktionen
und zugängliche Statusmeldungen ab. Nutze `retrieve` für die tatsächlich
verwendeten IDs und übertrage die Regeln in Task 5.

- [ ] **Step 1: Schreibe den ersten fehlschlagenden Utility-Test.**

```javascript
test("suggestionDraft returns the server allocation rows", () => {
  const booking = {
    status: "suggested",
    suggestion: {
      rule_id: "rule-1",
      allocations: [{ target: "household", amount: 42.37 }],
    },
  };

  assert.deepEqual(utils.suggestionDraft(booking), [
    { target: "household", amount: 42.37 },
  ]);
});
```

- [ ] **Step 2: Führe nur den neuen Node-Test aus und bestätige RED.**

Run: `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs --test-name-pattern="suggestionDraft returns"`

Expected: FAIL, weil `suggestionDraft` noch nicht exportiert wird.

- [ ] **Step 3: Implementiere die minimalen Pure Helpers.**

Implementiere:

```javascript
export function suggestionDraft(booking) {
  return booking?.status === "suggested"
    ? (booking.suggestion?.allocations || []).map((row) => ({ ...row }))
    : [];
}

export function ruleStatusLabel(status) {
  return {
    unresolved: "Manuelle Zuordnung erforderlich",
    suggested: "Regelvorschlag",
    conflict: "Regelkonflikt",
  }[status] || "Prüfung erforderlich";
}

export function rulePayloadFromForm(form) {
  return {
    label: form.label.trim(),
    active: Boolean(form.active),
    priority: Number(form.priority),
    account_id: form.account_id || null,
    counterparty: form.counterparty.trim(),
    purpose_contains: form.purpose_contains.trim() || null,
    allocations: form.allocations.map((row) => ({ ...row })),
  };
}
```

Exportiere zusätzlich eine `conflictRuleIds(booking)`-Hilfsfunktion, damit die
View keine API-Struktur selbst interpretieren muss.

- [ ] **Step 4: Führe die Utility-Tests aus und erweitere Grenzfälle.**

```javascript
test("suggestionDraft returns an empty list for unresolved bookings", () => { ... });
test("ruleStatusLabel explains conflict status", () => { ... });
test("rulePayloadFromForm trims text and keeps null filters", () => { ... });
```

Run: `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs`

Expected: PASS.

- [ ] **Step 5: Prüfe Syntax und committe die Frontend-Utilities.**

```bash
node --check custom_components/finanzplaner/frontend/panel-utils.mjs
git add custom_components/finanzplaner/frontend/panel-utils.mjs custom_components/finanzplaner/frontend/panel-utils.test.mjs
git commit -m "feat: add rule suggestion frontend helpers"
```

---

### Task 5: Regelverwaltung und Vorschlagsinteraktion im Panel

**Files:**
- Modify: `custom_components/finanzplaner/frontend/panel.js`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.mjs`
- Modify: `custom_components/finanzplaner/frontend/panel-utils.test.mjs`

**Interfaces:**
- Consumes: Rules API aus Task 2, abgeleitete Buchungsstatuswerte aus Task 3, Utility-Helpers aus Task 4, bestehende Formulare und Allocation-Drafts.
- Produces: die Views `Regeln`, `Regel anlegen`, `Regel bearbeiten`, Vorschlags-Hinweise in `Buchungen prüfen` und `Als Regel speichern` nach erfolgreicher Aufteilung.

Vor dem Editieren:

```bash
IMPECCABLE_HOME=/tmp/finanzplaner-impeccable bash .codex/skills/impeccable/scripts/impeccable context
```

Arbeite im `Operate`-Modus und übernehme die vorhandene visuelle Sprache,
Fachbegriffe und die bestehende Reihenfolge „Übersicht zuerst, Formular nach
Aktion“. Die im Projekt vorhandene Regel, dass `$impeccable` vor UI-Arbeit
erfolgreich funktionieren muss, bleibt aktiv.

- [ ] **Step 1: Schreibe den ersten fehlschlagenden Frontend-Test für den Vorschlags-Draft und die Aktion.**

Erweitere die vorhandenen Pure-Utility-Tests um die Interaktionsdaten, die
die View beim Klick auf `Vorschlag übernehmen` verwendet:

```javascript
test("acceptSuggestionDraft identifies the booking and copies allocations", () => {
  const result = utils.acceptSuggestionDraft({
    id: "booking-1",
    status: "suggested",
    suggestion: { allocations: [{ target: "household", amount: 42.37 }] },
  });

  assert.deepEqual(result, {
    bookingId: "booking-1",
    allocations: [{ target: "household", amount: 42.37 }],
  });
});
```

- [ ] **Step 2: Führe den Test aus und bestätige RED.**

Run: `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs --test-name-pattern="acceptSuggestionDraft"`

Expected: FAIL, weil der Helper noch fehlt.

- [ ] **Step 3: Implementiere den Helper und den Panel-State für Regeln.**

Füge einen `_rules`-State, einen `_ruleEditingId`-State und einen
`_ruleMessage`-State hinzu. Lade Regeln beim initialen Datenabruf und nach
Regeländerungen. Halte den bestehenden Fetch-Pfad und die
`hass.fetchWithAuth()`-Authentifizierung ein.

- [ ] **Step 4: Ergänze die Navigation und die Regelübersicht.**

Füge `Regeln` als klare Navigation innerhalb der bestehenden Panel-Struktur
hinzu. Die Übersicht zeigt eine semantische Tabelle mit Caption,
Spaltenüberschriften und Zeilenwerten für Regelname, Status, Priorität, Konto,
Zahlungsempfänger und Aufteilung. Zeige `Anlegen`, `Bearbeiten` und
`Deaktivieren` als beschriftete Buttons. Deaktivierte Regeln bleiben sichtbar.

- [ ] **Step 5: Ergänze das Regel-Formular mit validierten Zuständen.**

Gruppiere Bedingungen und Aufteilungsvorlage in Fieldsets. Verwende echte
Labels, passende `id`/`for`-Verbindungen, sichtbare Fokuszustände und
Fehlermeldungen neben dem betroffenen Feld. Deaktiviere Speichern während des
Requests, unterscheide unverändert/geändert/speichernd/gespeichert/fehlerhaft
und kehre nach erfolgreichem Speichern zur Tabellenübersicht zurück.

Die Formularfelder bleiben auf Konto, Zahlungsempfänger, optionalen
Verwendungszweckfilter, Priorität, Ziel, Anteil und aktive Katalog-/Tier-
Referenzen begrenzt. Die View prüft die Anteilssumme vor dem Request und
verlässt sich zusätzlich auf die Servervalidierung.

- [ ] **Step 6: Integriere `suggested` und `conflict` in die Prüfliste.**

Bei `suggested` rendere direkt an der Buchung einen beschrifteten Hinweis mit
Regelname, Matching-Grund und Vorschlagszeilen. `Vorschlag übernehmen` kopiert
die Zeilen ausschließlich in den bestehenden Draft. Danach bleibt
`Aufteilung speichern` der explizite Schreibschritt.

Bei `conflict` rendere die konkurrierenden Regeln und eine Aktion zur
Regelverwaltung. Wähle keine Regel automatisch und ändere keine Buchung.

- [ ] **Step 7: Ergänze `Als Regel speichern` nach erfolgreicher Buchungsbestätigung.**

Nach einem erfolgreichen Response von `BookingAllocationsView` beziehungsweise
der bestehenden Assignment-View zeige die Aktion `Als Regel speichern`. Lade
die Regel-Form-Ansicht mit Konto, Zahlungsempfänger und bestätigten
Aufteilungen vor. Lasse `purpose_contains` leer. Sende erst nach einer
weiteren Nutzeraktion an `/rules/from-booking/{booking_id}` und zeige Fehler
im bestehenden `aria-live`-Statusbereich.

- [ ] **Step 8: Ergänze leere, Lade-, Fehler- und deaktivierte Zustände.**

Zeige bei keiner Regel eine verständliche leere Regelübersicht mit der Aktion
`Regel anlegen`. Zeige bei Ladefehlern eine Statusmeldung statt eines leeren
Formulars. Halte Konflikte, ungültige Regelziele, archivierte Kataloge und
fehlende Personen sichtbar und handlungsfähig. Stelle sicher, dass alle
interaktiven Elemente per Tastatur erreichbar sind und Touch-Ziele nicht nur
aus Icon-Flächen bestehen.

- [ ] **Step 9: Führe den Impeccable-Detector für die geänderte UI aus.**

```bash
IMPECCABLE_HOME=/tmp/finanzplaner-impeccable bash .codex/skills/impeccable/scripts/impeccable hook
```

Behebe jeden Befund, der die Vorschlags- oder Regeloberfläche betrifft, in
demselben bounded Pass. Begründe verbleibende Befunde im Übergabestatus.

- [ ] **Step 10: Führe Frontend-Syntax- und Utility-Tests aus.**

Run: `node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs`

Run: `node --check custom_components/finanzplaner/frontend/panel.js`

Run: `node --check custom_components/finanzplaner/frontend/panel-utils.mjs`

Expected: PASS ohne Warnungen.

- [ ] **Step 11: Committe die Panel-Integration.**

```bash
git add custom_components/finanzplaner/frontend/panel.js custom_components/finanzplaner/frontend/panel-utils.mjs custom_components/finanzplaner/frontend/panel-utils.test.mjs
git commit -m "feat: add booking rule review ui"
```

---

### Task 6: Produktdokumentation und vollständige Verifikation

**Files:**
- Modify: `PRODUCT.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Verify: `AGENTS.md`
- Verify: `.impeccable/config.json`
- Verify: `.impeccable/surfaces/finanzuebersicht.md`
- Verify: `.codex/hooks.json`

**Interfaces:**
- Consumes: die fertig implementierten Core-, API- und Panel-Verträge aus Tasks 1 bis 5.
- Produces: konsistente Produktbeschreibung, aktuelle Bedienungsdokumentation und einen nachvollziehbaren Unreleased-Eintrag.

- [ ] **Step 1: Schreibe den fehlschlagenden Dokumentations-Check.**

Prüfe mit einer kleinen textuellen Regression, dass die drei Produktdokumente
die neue Fähigkeit nennen:

```bash
rg -n "regelbasierte|Regelvorschlag|Buchungsregeln|Vorschlag übernehmen" PRODUCT.md README.md CHANGELOG.md
```

Expected: Der Check findet vor der Dokumentationsänderung keinen vollständigen
Eintrag für die ausgelieferte Regelverwaltung und den bestätigungspflichtigen
Vorschlag.

- [ ] **Step 2: Aktualisiere `PRODUCT.md`.**

Verschiebe die Aussage „regelbasierte Vorschläge ... sind noch nicht geliefert“
in eine gelieferte Fähigkeit und dokumentiere die Grenzen: manuelle
Bestätigung, Konfliktstatus, lokale Verarbeitung und keine automatische
Speicherung.

- [ ] **Step 3: Aktualisiere `README.md`.**

Ergänze die Bedienfolge für `Regeln`, `Vorschlag übernehmen` und `Als Regel
speichern`. Beschreibe, dass Regeländerungen bestehende bestätigte
Buchungsaufteilungen nicht rückwirkend verändern. Entferne die Aussage, dass
automatische Regelvorschläge nicht Bestandteil der Version sind.

- [ ] **Step 4: Ergänze `CHANGELOG.md` unter `Unreleased`.**

Dokumentiere Regelverwaltung, Konto-/Zahlungsempfänger-Matching,
priorisierte Vorschläge, Konflikterkennung und die ausdrückliche Bestätigung.
Erhöhe die Versionsnummer nicht.

- [ ] **Step 5: Verifiziere den Impeccable-Zustand.**

```bash
IMPECCABLE_HOME=/tmp/finanzplaner-impeccable bash /home/eggerd/.agents/skills/impeccable/scripts/impeccable doctor --json
```

Expected: `findings` ist leer. Der Surface-Brief zeigt auf
`custom_components/finanzplaner/frontend/panel.js`; der Hook-Adapter und sein
Linux-/Windows-Aufruf bleiben vorhanden.

- [ ] **Step 6: Führe die vollständige Testmatrix aus.**

```bash
python3 -m unittest discover -s tests -v
node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs
node --check custom_components/finanzplaner/frontend/panel.js
node --check custom_components/finanzplaner/frontend/panel-utils.mjs
python3 -m compileall -q custom_components
git diff --check
```

Expected: Alle Tests, Syntaxprüfungen und `git diff --check` bestehen ohne
Fehler oder Warnungen.

- [ ] **Step 7: Prüfe den finalen Änderungsumfang.**

```bash
git status --short
git diff --stat
git diff -- PRODUCT.md README.md CHANGELOG.md custom_components tests
```

Stelle sicher, dass keine privaten Finanzdateien, vollständigen IBANs,
temporären Engine-Dateien oder nicht zur Regel-Funktion gehörenden Änderungen
im Diff liegen.

- [ ] **Step 8: Committe Dokumentation und Abschlussprüfungen.**

```bash
git add PRODUCT.md README.md CHANGELOG.md
git commit -m "docs: document booking rule suggestions"
```

## Spec Coverage Check

| Spezifikationsbereich | Planaufgabe |
|---|---|
| Regelmodell und Validierung | Task 1 |
| Exaktes Matching und optionale Verwendungszwecke | Task 1 |
| Priorität und Konflikte | Task 1 und Task 3 |
| Centgenaue Prozentmaterialisierung | Task 1 |
| Ableitbarer Status ohne Store-Mutation | Task 3 |
| Authentifizierte Regel-CRUD-API | Task 2 |
| Regel aus bestätigter Buchung | Task 2 und Task 5 |
| Vorschlags- und Konfliktzustände im Panel | Task 4 und Task 5 |
| `$impeccable`- und `modern-web-guidance`-Pflicht | Global Constraints und Task 4/5 |
| Migration ohne Hauptversionsänderung | Task 2 und Task 6 |
| Datenschutz und maskierte Kontodaten | Task 2, Task 3 und Task 6 |
| Produktdokumentation und Unreleased-Eintrag | Task 6 |
| Vollständige Qualitätssicherung | Task 6 |
