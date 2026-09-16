# Änderungsprotokoll

Alle wichtigen Änderungen am Finanzplaner werden hier dokumentiert.

Das Projekt verwendet Semantic Versioning:

- `MAJOR`: inkompatible Änderungen an Datenmodell oder Bedienung
- `MINOR`: neue rückwärtskompatible Funktionen
- `PATCH`: Fehlerkorrekturen und kleine Verbesserungen

## Unreleased

## [0.3.1] – 2026-09-16

- Planposten-Ansicht mit authentifiziertem CRUD-API, Rhythmus, Fälligkeit und Gültigkeitszeitraum ergänzt
- Planposten werden beim Archivieren deaktiviert und bleiben für eine spätere Reaktivierung erhalten
- lokale Tierprofile mit stabilem Schlüssel, Tier-Typ und reversibler Archivierung ergänzt
- optionale Tierreferenzen in Planposten und Buchungsaufteilungen ergänzt; historische Namen bleiben als Snapshot erhalten
- Bereiche in Aufteilungen sind frei benennbar und nicht mehr auf eine feste Whitelist begrenzt
- Futterprofile mit Verpackungseinheit, Kaufkosten, Verbrauchsintervall und Vorwarnfenster ergänzt
- bestätigte Futterkäufe, durchschnittliche Kaufabstände und Status für die nächste Kaufprognose ergänzt
- erwartete Futterkäufe als einmaliges Ereignis in die Monatsprognose sowie als HA-Sensor aufgenommen
- Futter-Erinnerungsstatus als automationstauglichen Binary-Sensor und Kaufbestätigungs-Service ergänzt
- Kategorien, Bereiche und Projekte als lokal verwaltete Stammdaten mit stabilen IDs und Namens-Snapshots ergänzt
- Planposten und Buchungsaufteilungen auf katalogisierte Zuordnungen migriert; archivierte Einträge bleiben historisch lesbar

## [0.3.0] – 2026-09-15

- Konten bei CAMT.053- und MT940-Importen automatisch erkannt und bestehenden Buchungen stabil zugeordnet
- Kontenansicht für Anzeigename, mehrere Home-Assistant-Kontoinhaber und Archivstatus ergänzt
- bestätigungspflichtige Buchungsaufteilungen mit frei änderbaren, centgenauen Beträgen sowie Ziel, Bereich, Kategorie und Projekt eingeführt
- gemeinsame Ausgaben als `household` mit optionalem Bereich `Hunde` modelliert, ohne Kontoinhaber automatisch als Buchungsziele zu übernehmen
- vollständige IBANs an API-Grenzen maskiert und Klartextfehler im Panel lesbar gemacht

## [0.2.3] – 2026-09-15

- statische Panel-Dateien je Release über einen eigenen URL-Pfad ausgeliefert, damit Browser- und Proxy-Caches keine ältere Oberfläche weiterverwenden

## [0.2.2] – 2026-09-15

- authentifizierte Panel-API-Aufrufe für Excel-, Bankimport und Prüfliste repariert

## [0.2.1] – 2026-09-15

- HACS- und Home-Assistant-Branding-Assets ergänzt
- README um eine visuelle Produktdarstellung erweitert

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
[0.2.1]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.2.1
[0.2.2]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.2.2
[0.2.3]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.2.3
[0.3.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.3.0
