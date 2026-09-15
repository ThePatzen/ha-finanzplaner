# Änderungsprotokoll

Alle wichtigen Änderungen am Finanzplaner werden hier dokumentiert.

Das Projekt verwendet Semantic Versioning:

- `MAJOR`: inkompatible Änderungen an Datenmodell oder Bedienung
- `MINOR`: neue rückwärtskompatible Funktionen
- `PATCH`: Fehlerkorrekturen und kleine Verbesserungen

## [0.2.0] – 2026-09-15

- Excel-Finanzplanvorlage mit Vorschau, Warnungen und bestätigungsgebundener Übernahme
- positive Planbeträge mit Richtung `income`, `expense` oder `saving`
- Zuordnungsvorschläge für Gehalt, PV-Anlage, Hunde, Urlaubsgeld und EMX
- Rücksprung aus dem Panel zur normalen Home-Assistant-Oberfläche inklusive URL-Unterpfad

## [0.1.1] – 2026-09-14

- HACS-Installation auf den normalen GitHub-Quellarchiv-Download umgestellt
- fehlerhafte Abhängigkeit von einem nicht vorhandenen `finanzplaner.zip`-Release-Asset entfernt

## [0.1.0] – 2026-09-14

Erste vorbereitete vertikale Version:

- HACS- und Home-Assistant-Integrationsstruktur
- native Übersicht für Planung, Prognose, Ist und ungeklärte Buchungen
- MT940- und CAMT.053-Import mit Duplikaterkennung
- Home-Assistant-Personen als Zuordnungsziele
- Mehrfachzuordnung auf Personen, Haushalt und den Bereich Hunde
- persistenter lokaler Speicher und zentrale HA-Sensoren
- visuelles Konzept „Statusfeld mit Prüfstreifen"

[0.1.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.1.0
[0.1.1]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.1.1
[0.2.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.2.0
