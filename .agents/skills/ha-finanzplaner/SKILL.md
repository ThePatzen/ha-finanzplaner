---
name: ha-finanzplaner
description: Routing-Skill für Arbeiten am Home-Assistant-Finanzplaner, insbesondere Backend, Storage, Importe, Panel, Sensoren, Services, Tests, Migrationen und Releases.
---

# HA Finanzplaner

## Zweck und Auslöser

Diesen Skill verwenden, wenn eine Aufgabe die Finanzplaner-Integration oder
ihre eingebettete Oberfläche betrifft. Er liefert Projektorientierung und
verweist auf die passende fachliche, technische oder spezialisierte Anleitung;
er ersetzt keine gezielte Prüfung der betroffenen Quelltexte.

## Zuerst lesen

Vor jeder Änderung in dieser Reihenfolge lesen:

1. `PRODUCT.md`
2. `README.md`
3. `CHANGELOG.md`
4. die für die Aufgabe passende Datei unter `docs/`

Für Orientierung und Auswahl sind besonders maßgeblich:

- [`docs/architecture.md`](../../../docs/architecture.md) für Datenfluss,
  Verzeichnisgrenzen und risikoreiche Dateien
- [`docs/domain-invariants.md`](../../../docs/domain-invariants.md) für
  Datenschutz, Persistenz, Konten, Zuordnungen, Importe, Regeln und Releases
- [`docs/workflows/testing.md`](../../../docs/workflows/testing.md) für die
  risikobasierte Prüfmatrix
- [`docs/workflows/release.md`](../../../docs/workflows/release.md) für
  autorisierte Versions- und Releasearbeiten

Wenn für den Aufgabenbereich ein spezialisierter Projekt-Skill vorhanden ist,
diesen nach der Projektlektüre zusätzlich auswählen und befolgen.

## Verzeichnis- und Quellenauswahl

- `custom_components/finanzplaner/`: Integration, Domänenlogik, API, Storage,
  Importe, Sensoren und Services
- `custom_components/finanzplaner/frontend/`: natives Panel, Helfer und
  Frontend-Tests
- `tests/`: Python-Regressionstests
- `docs/`: gepflegte Architektur-, Invarianten-, Workflow- und Planungsdokumente
- `scripts/check-fast`, `scripts/check-full`: stabile Prüf-Einstiegspunkte

Gezielt auswählen: `core.py` für Domänenlogik, `storage.py` für Persistenz,
Normalisierung und Migrationen, `http.py` für authentifizierte API-Grenzen,
`coordinator.py` für Zustandsaktualisierung, `importers/` für Bank- und
Excelimporte, `frontend/panel.js` für Panel-State/Ereignisse und
`frontend/panel-utils.mjs` samt Testdatei für testbare Frontend-Helfer. Vor
breiter Suche zuerst die Architektur, dann passende Quell- und Testdateien
mit engen `rg`-Mustern prüfen.

## Dauerhafte Grenzen

- Vollständige IBANs und rohe Bankdaten bleiben lokal; API, Panel, Logs,
  öffentliche Dateien und Beispiele verwenden maskierte Kontodaten.
- Home-Assistant-Personen kommen aus `person.*`; Kontoinhaber beschreiben nur
  die Zahlungsquelle und werden nie automatisch zu Buchungszielen.
- Ziele, Bereiche, Kategorien, Projekte und Tiere bleiben getrennt. Positive
  Cent-Aufteilungen müssen den absoluten Buchungsbetrag exakt ergeben.
- Schemaänderungen brauchen Migration und Regressionstests. Abgelehnte Importe
  dürfen den Store nicht verändern; Duplikate dürfen keine zweite Buchung
  erzeugen.
- Regelübernahmen sind nur bei gültigem, eindeutigem Treffer mit höchster
  Priorität zulässig; Konflikte bleiben prüfpflichtig.
- Panel-Anfragen bleiben authentifiziert und Responses maskiert; bestehende
  Response-Formen nur bei begründetem Bedarf ändern.

## Prüfungen nach Risiko

Die Auswahl folgt `docs/workflows/testing.md`:

- Nur Markdown oder Skill: `scripts/check-fast` und `git diff --check`
- Ein Python-Modul oder Backendverhalten: passendes `scripts/test-file` plus
  `scripts/check-fast`
- Panel oder Frontend-Helfer: passendes `scripts/test-file` plus
  `node --check custom_components/finanzplaner/frontend/panel.js`
- Storage, Import, API oder Querschnitt: `scripts/check-full`
- Releasevorbereitung: `scripts/check-full` plus
  `docs/workflows/release.md`

Fehlt Node.js, Frontend-Prüfungen ausdrücklich als nicht ausgeführt melden.

## Verbotene Abkürzungen

- Keine direkten Änderungen an Home-Assistant-`.storage`-Dateien.
- Keine privaten Finanzdaten, vollständigen Kontoreferenzen oder unveränderten
  Bankdateien in Repository, Tests, Logs, Assets oder Ausgaben.
- Keine Versionsänderung, Tags, Pushes oder Releases ohne ausdrückliche
  Freigabe; Releasebefehle folgen dem Releaseworkflow.
- Keine breiten Repository-Ausgaben oder vollständigen großen Dateien, wenn
  eine gezielte Suche oder ein begrenzter Ausschnitt genügt.
