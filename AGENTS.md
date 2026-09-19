# Arbeitsanweisungen

## Einstieg und Inhaltsübersicht

Vor jeder Änderung zuerst [PRODUCT.md](PRODUCT.md), [README.md](README.md)
und [CHANGELOG.md](CHANGELOG.md) lesen. Danach nur die für die Aufgabe
relevanten Quellen und Tests öffnen:

- [docs/architecture.md](docs/architecture.md): Komponenten, Datenflüsse und wichtige Einstiegspunkte
- [docs/domain-invariants.md](docs/domain-invariants.md): fachliche und technische Invarianten
- [docs/workflows/testing.md](docs/workflows/testing.md): risikobasierte Prüfmatrix
- [docs/workflows/release.md](docs/workflows/release.md): Versionierung und Release-Sicherheit

Diese Dokumente enthalten das dauerhafte Projektwissen. Skripte und Skills
verweisen darauf, statt dieselben Fakten zu duplizieren.

## Verzeichnisübersicht

- `custom_components/finanzplaner/`: Backend-Integration, Core, Speicher, API, Importe, Sensoren und Services
- `custom_components/finanzplaner/frontend/`: natives Panel sowie Frontend-Helfer und Node-Tests
- `tests/`: Python-Tests für Backend, Importe, Persistenz und fachliche Abläufe
- `docs/`: dauerhafte Dokumentation sowie `docs/superpowers/{plans,specs}/`
- `scripts/`: ausführbare Prüf- und Entwicklungsbefehle des Harness
- `.agents/skills/`: projektspezifische Skills und ihre Einstiegspunkte
- `assets/`: visuelle und HACS-Assets
- `template/`: Excel-Referenzvorlage; sie enthält private Referenzdaten und gehört nicht in Änderungen oder Ausgaben

Die kleinsten relevanten Einstiegspunkte sind `core.py`, `storage.py`,
`http.py`, `coordinator.py`, `frontend/panel.js` und
`frontend/panel-utils.mjs`; die passenden Regressionen liegen vor allem in
`tests/test_finanzplaner_core.py`, `tests/test_account_import.py`,
`tests/test_accounts_and_migration.py`, `tests/test_rules.py` und
`custom_components/finanzplaner/frontend/panel-utils.test.mjs`.

## Arbeitsregeln

- Bestehende Benutzeränderungen bleiben erhalten. Niemals unbeteiligte Dateien
  formatieren, überschreiben oder mit `git add -A` aufnehmen.
- Suche zuerst mit `rg` oder `rg --files`, eng gefiltert und ohne generierte
  oder abhängige Verzeichnisse breit einzulesen. Große Dateien nur in den
  benötigten Ausschnitten öffnen.
- Vollständige IBANs und rohe Bankdaten bleiben lokal; API, Oberfläche, Logs
  und öffentliche Dateien verwenden Maskierung.
- Schemaänderungen brauchen Migration und Regressionstests. Direkte
  Änderungen an Home-Assistant-`.storage`-Dateien sind verboten.
- Kontoinhaber beschreiben Zahlungsquellen, nicht automatisch Buchungsziele.
  Ziele, Bereiche, Kategorien, Projekte und Tiere bleiben fachlich getrennt.
- Änderungen an HTML, CSS, clientseitigem JavaScript, Layout, Navigation,
  Formularen, Tabellen, Zuständen, Barrierefreiheit oder visueller Politur
  erfordern den Projekt-Skill `$impeccable`.
- Für Markdown- oder Skill-Änderungen genügt der schnelle Check; für Code gilt
  die [Prüfmatrix](docs/workflows/testing.md).

## Kanonische Standardprüfungen

Die folgenden Namen sind die kanonischen Einstiegspunkte des Harness:

```bash
scripts/check-fast
scripts/test-file <path>
scripts/check-full
```

`scripts/test-file <path>` erhält den konkreten passenden Testpfad, zum
Beispiel `tests/test_rules.py`. Die Auswahl der Befehle richtet sich
nach `docs/workflows/testing.md`.

GitHub-Befehle, Pushes, Tags und Release-Veröffentlichungen benötigen eine
explizite Freigabe. Die Release-Reihenfolge steht in
[docs/workflows/release.md](docs/workflows/release.md).
