---
name: ha-finanzplaner
description: Projekt-Skill für die Weiterentwicklung des Home-Assistant-Finanzplaners im HACS-Repository ThePatzen/ha-finanzplaner. Verwenden bei Änderungen an Konten, Bank-/Excel-Importen, Personen- und Haushaltszuordnungen, Hunde-Bereichen, Planposten, Prognosen, Buchungen, Sensoren, Panel-UI, Storage-Migrationen, Releases oder der Produkt-Roadmap.
---

# HA Finanzplaner

## Zweck und Kontext

Den Finanzplaner als lokale Home-Assistant-Custom-Integration weiterentwickeln.
Er ersetzt die private Finanzplan-Excel durch eine schnelle Monatsübersicht,
strukturierte Planposten, manuelle Bankimporte und nachvollziehbare
Buchungsaufteilungen für mehrere Personen in einem gemeinsamen Haushalt.

Das Repository liegt unter `/home/eggerd/Development/ha-finanzplaner` und wird
über HACS verteilt: `https://github.com/ThePatzen/ha-finanzplaner`.
Die fachliche Referenz ist `template/Finanzplan Template.xlsx`; die Originaldatei
und echte Finanzdaten dürfen nicht in das öffentliche Repository gelangen.

## Fachliche Leitplanken

- Personen aus Home Assistant live über `person.*` einlesen. Keine parallele
  Personenstammdatenverwaltung anlegen.
- Ein Konto darf mehrere Kontoinhaber haben. `owner_targets` beschreibt nur die
  Zahlungsquelle und weist Buchungen niemals automatisch diesen Personen zu.
- Buchungen einer Person, mehreren Personen oder dem gemeinsamen Ziel
  `household` zuordnen.
- Gemeinsame Hundekosten mit `area="Hunde"` modellieren, typischerweise mit
  `target="household"`. Keine einzelnen Hunde als Personen anlegen.
- Gehalt als `Einnahmen / Erwerbseinkommen / Gehalt` führen.
- PV-Erlöse als `Einnahmen / Energieerlöse / PV-Erlöse` mit Projekt
  `PV-Anlage` führen. Wartung, Versicherung und Finanzierung der PV-Anlage als
  getrennte Ausgaben im selben Projekt planen.
- Kontoinhaber, Buchungsziel, Bereich, Kategorie und Projekt fachlich getrennt
  halten.
- Aufteilungen nur mit positiven Centbeträgen speichern; die Summe muss dem
  Absolutwert des Buchungsbetrags exakt entsprechen.

## Aktueller Stand

Bereits geliefert:

- HACS-/Custom-Integration mit Config Flow, persistentem Store und
  versioniertem statischem Panel-Pfad.
- Übersicht mit aktuellem Monat, Planung, Prognose, Ist, Abweichung und Anzahl
  ungeklärter Buchungen; Home-Assistant-Navigation bleibt erreichbar.
- Live-Import von MT940 und CAMT.053 per bewusstem lokalem Datei-Upload,
  inklusive Multi-Konto-Verarbeitung, Kontoerkennung und Duplikaterkennung.
- Excel-Vorschau und bestätigbarer Import der relevanten Blätter aus der
  Finanzplanvorlage.
- Kontenansicht mit Anzeigename, Bankname, maskierter Kontoangabe, mehreren
  Kontoinhabern, Archivstatus und bearbeitbarer IBAN.
- IBAN wird bei manueller Eingabe normalisiert, länderspezifisch geprüft und
  per Modulo 97 validiert. Eine leere Eingabe lässt eine vorhandene IBAN
  unverändert; doppelte IBANen werden abgewiesen.
- Vollständige IBAN nur im lokalen Store speichern. API, UI und verschachtelte
  Response-Daten maskieren IBANs; keine vollständigen IBANs in Logs oder
  öffentlichen Dateien.
- Prüfliste für ungeklärte Buchungen mit manueller, centgenauer Aufteilung auf
  Personen oder Haushalt sowie Bereich `Hunde`, Kategorie und Projekt.
- HA-Personen und authentifizierte Panel-API-Aufrufe über
  `hass.fetchWithAuth()`.
- 75 Python- und 21 Node-Tests sowie Syntax-, Compile-, JSON- und Diff-Checks
  für den aktuellen Stand.

Aktuelle Release-Situation:

- Code-Stand enthält die Bank-/IBAN-Erweiterung in den Commits `f36ffc6` und
  `5a4c682`.
- Der lokale Tag `v0.3.0` zeigt noch auf den vorherigen Stand `d01a588`.
- Für einen HACS-Release Manifest, Changelog, neuer Tag `v0.3.1`, GitHub-Release
  und gegebenenfalls das erwartete ZIP-Asset gemeinsam aktualisieren.
- Nichts zu GitHub pushen, solange der Nutzer keinen ausdrücklichen
  Release-/Push-Auftrag erteilt.

## Persistenz- und API-Regeln

Das Datenmodell liegt in `custom_components/finanzplaner/storage.py` und hat
Schema-Version 2. Ein Konto enthält mindestens:

```text
id, label, bank, iban, account_reference, currency,
owner_targets, active, created_at, updated_at
```

Eine Buchung enthält mindestens `account_id`, `account_reference`, die
normalisierten Buchungsfelder, `allocations` und `status`.

- `account_id` ist die stabile lokale Zahlungsquellen-ID und darf beim normalen
  v2-Reload nicht aus einer späteren Referenz neu berechnet werden.
- `account_reference` bleibt als normalisierte Importangabe erhalten, auch wenn
  MT940 keine IBAN liefert.
- Unbekannte Konten werden neutral ohne Kontoinhaber und ohne automatische
  Buchungszuordnung angelegt.
- v1-Migration und normale v2-Normalisierung getrennt halten. Keine direkten
  Änderungen an Home-Assistant-`.storage`-Dateien vornehmen.
- Neue API-Views in `http.py` authentifizieren. Erfolgreiche Response-Formen
  nicht ohne Not ändern.
- Vor einer API-Antwort `_response_payload()` beziehungsweise die bestehende
  Maskierungslogik verwenden; auch beliebige verschachtelte Strings prüfen.
- Beim Ändern eines Kontos nur editierbare Werte ändern. Eine leere/fehlende
  IBAN darf die bestehende lokale IBAN nicht löschen.

## Offene Implementierungsschritte

Die folgenden Schritte sind die verbleibende Roadmap. Nach Möglichkeit in dieser
Reihenfolge umsetzen:

### 1. Release und Laufzeitsicherung

- Manifest und `CHANGELOG.md` auf die Bank-/IBAN-Erweiterung aktualisieren.
- Version `0.3.1` und HACS-Release vorbereiten.
- ZIP-/Release-Asset und Installation aus HACS prüfen.
- Einen echten Home-Assistant-Laufzeittest durchführen: Config Flow, Panel,
  Personen, Konto speichern, MT940/CAMT53 importieren, Zuordnung speichern,
  Neustart und Reload.
- Anonymisierte reale MT940-/CAMT53-Dateien als lokale oder geschützte
  Regression-Fixtures ergänzen; keine echten Kontodaten committen.

### 2. Planposten-Verwaltung als Excel-Ersatz

- Eigene Finanzplaner-/Planpostenansicht statt nur Excel-Import erstellen.
- Planposten anlegen, bearbeiten, archivieren und löschen beziehungsweise
  deaktivieren.
- Felder für Richtung, Kategorie, Bereich, Projekt, Betrag, Rhythmus,
  Fälligkeit, Gültigkeitszeitraum und optional Person/Haushalt ergänzen.
- Monats-, jährliche und einmalige Planungen aus der Excel-Struktur abbilden.
- Gehalt, PV-Erlöse, Hunde, Urlaubsgeld und EMX sauber als fachliche Werte
  darstellen, nicht nur als Importwarnung.
- Planposten-CRUD mit Storage-Migration, API-Validierung und Panel-Draft-State
  testen.

### 3. Belastbare Berechnungs- und Prognoseengine

- Planwerte nach Monat und Fälligkeit statt pauschal über alle Planposten
  berechnen.
- Tatsächliche Buchungen, zukünftige Planposten und bestätigte Aufteilungen
  nachvollziehbar zur Prognose verbinden.
- Monats-, Jahres- und Cashflow-Sicht ergänzen.
- Plan-Ist-Vergleiche nach Kategorie, Bereich, Projekt, Person und Konto
  liefern.
- Einnahmen, Ausgaben, Rücklagen, Sonderzahlungen und verfügbaren Saldo
  konsistent definieren.
- Bereiche und Kategorien in Live-Daten statt nur in Demo-Daten füllen.

### 4. Vollständiger Buchungsworkflow

- Historische beziehungsweise bereits geklärte Buchungen anzeigen.
- Buchungen suchen und nach Zeitraum, Konto, Person, Ziel, Kategorie, Bereich
  und Projekt filtern.
- Gespeicherte Aufteilungen nachträglich bearbeiten, ohne Kontoinhaber zu
  verändern.
- Importhistorie und Duplikatentscheidungen nachvollziehbar anzeigen.
- Fehlerhafte oder nicht mehr auflösbare `person.*`-Referenzen markieren und
  eine Reparatur anbieten, ohne historische Beträge zu verlieren.

### 5. Regelbasierte Vorschläge

- Regeln für Konto, Gegenpartei, Gegenpartei-IBAN, Verwendungszweck, Betrag
  und Richtung definieren.
- Aktionen für Zielpersonen, Haushalt, Kategorie, Bereich und Projekt
  vorschlagen.
- Prioritäten und Konflikte deterministisch behandeln.
- Regeln nur als sichtbare, bestätigungspflichtige Vorschläge anwenden; keine
  stille automatische Buchung.
- Bestätigte Vorschläge und Rücknahme protokollieren.

### 6. Auswertungen, Sensoren und Benachrichtigungen

- Sensoren für Plan, Ist, Prognose, offenen Betrag, Anzahl ungeklärter
  Buchungen, nächste größere Zahlung und Haushalts-Saldo vervollständigen.
- Monats-/Jahresberichte, Kategorien, Bereiche, Projekte und PV-Auswertung
  als Panel-Sichten ergänzen.
- Optional wiederkehrende Reports und Home-Assistant-Benachrichtigungen bauen.

### 7. Spätere Ausbaustufen

- regelmäßige automatische Dateiübernahme
- mehrere Szenarien und Jahresversionen
- weitere CAMT-Varianten
- direkte Open-Banking- oder Bank-API-Anbindung
- mehrere Währungen
- detailliertere Steuer- und PV-Auswertungen

Diese Punkte gehören nicht in den nächsten kleinen Funktionsschritt, solange die
Planposten-, Prognose- und Buchungshistorie noch fehlen.

## Entwicklungsworkflow

1. Vor Änderungen die relevanten Dateien sowie
   `docs/superpowers/specs/`, `docs/superpowers/plans/`, `PRODUCT.md` und
   `README.md` lesen.
2. Bestehende Datenverträge und die Trennung von Zahlungsquelle und Zweck
   bewahren. Bei Schemaänderungen zuerst Migration und Regressionstests planen.
3. Für Backend-Änderungen `core.py`, `storage.py`, `http.py`,
   `coordinator.py` und die passenden `tests/` prüfen.
4. Für Panel-Änderungen `frontend/panel.js`, `frontend/panel-utils.mjs` und
   `panel-utils.test.mjs` gemeinsam prüfen. Keine neue Frontend-Bibliothek
   einführen. Authentifizierte Requests und zentrale Response-Auswertung
   wiederverwenden.
5. Lokale Dateien mit `apply_patch` ändern. Keine destruktiven Git-Befehle und
   keine direkten HA-`.storage`-Edits ausführen.
6. Vor dem Abschluss mindestens ausführen:

   ```bash
   python3 -m unittest discover -s tests -p 'test*.py' -v
   node custom_components/finanzplaner/frontend/panel-utils.test.mjs
   node --check custom_components/finanzplaner/frontend/panel.js
   python3 -m compileall -q custom_components tests
   python3 -m json.tool custom_components/finanzplaner/manifest.json >/dev/null
   git diff --check
   ```

7. Bei UI-Änderungen Loading-, Fehler-, Leer-, Disabled-, Tastatur- und
   Responsive-Zustände prüfen. Bestehende visuelle Sprache beibehalten:
   schneller Überblick, klare Zahlen, ruhige helle Oberfläche, dunkelblaue
   Home-Assistant-Navigation und sichtbare Warnung für ungeklärte Buchungen.
8. Committen, aber nur nach ausdrücklichem Auftrag zu GitHub pushen oder einen
   Release-Tag veröffentlichen.

## Verbindliche Abnahmekriterien

- Keine vollständige IBAN in API, UI, Logs, Tests mit echten Daten oder
  öffentlichen Assets.
- Mehrere Personen als Kontoinhaber und mehrere Buchungsziele bleiben möglich.
- Kontoinhaber verändern niemals automatisch historische oder neue
  Buchungsaufteilungen.
- `Hunde` bleibt ein gemeinsamer Bereich und keine künstliche Person.
- Importfehler verändern den Store nicht; Duplikate erzeugen keine zweite
  Buchung.
- v2-Reloads bewahren IDs, Owner, Bank, IBAN und historische Aufteilungen.
- API- und Panel-Fehler bleiben verständlich, auch wenn Home Assistant
  Klartext statt JSON zurückgibt.
- Vor einem Release müssen Tests, HACS-Struktur und nach Möglichkeit ein echter
  Home-Assistant-Laufzeittest erfolgreich sein.
