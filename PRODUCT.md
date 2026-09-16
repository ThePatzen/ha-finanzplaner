# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Python-basierte Home-Assistant-Custom-Integration mit einer nativen, in Home Assistant eingebetteten Finanzoberfläche. Die Integration wird über HACS verteilt. Ein separates Frontend-Framework ist nicht festgelegt.

## Users

Mehrere Personen in einem gemeinsamen privaten Haushalt. Die Personen kommen aus den vorhandenen Home-Assistant-`person.*`-Entitäten. Ein Konto kann mehreren Personen gehören; einzelne Buchungen können einer Person, mehreren Personen oder dem gemeinsamen Haushalt zugeordnet werden.

## Product Purpose

Der Finanzplaner ersetzt die bisherige private Finanzplan-Excel-Datei. Er verbindet wiederkehrende Planung mit tatsächlichen Bankbuchungen und zeigt, wie Einnahmen, Ausgaben, Rücklagen und Sonderzahlungen den Haushalt beeinflussen.

Erfolg bedeutet, dass der Haushalt seine Excel-Planung vollständig abbilden, MT940- und CAMT.053-Dateien lokal importieren, Buchungen zuverlässig zuordnen und Planung sowie Ist-Werte gemeinsam auswerten kann.

## Positioning

Der Finanzplaner verbindet die strukturierte Planung wiederkehrender Zahlungen mit einem lokalen Home-Assistant-Workflow. Die Integration nutzt bestehende HA-Personen, unterstützt gemeinsame Konten und mehrstufige Buchungsaufteilungen und verarbeitet Bankdateien ohne Bankzugangsdaten oder externe Finanzplattform.

## Operating Context

Die Anwendung läuft in einer privaten Home-Assistant-Installation und wird über HACS installiert und aktualisiert. Nutzer pflegen Planposten, Konten und bestätigte Buchungsaufteilungen in der Finanzansicht und laden exportierte Bankdateien bewusst zur Verarbeitung hoch.

Die bestehende Excel-Datei dient als fachliche Referenz und als Quelle für eine einmalige Migration. Sie enthält Einnahmen, Ausgaben, Rücklagen, Urlaubsgeld und projektbezogene Kostenverrechnung für EMX. Bereiche wie „Hunde“ und Projekte wie „PV-Anlage“ gehören zum fachlichen Modell.

## Capabilities and Constraints

Mit Version 0.3.0 geliefert:

- automatische lokale Kontoerkennung aus CAMT.053 und MT940
- Kontenpflege mit mehreren Home-Assistant-Personen oder `Haushalt` als Kontoinhaber
- klare Trennung von Kontoinhabern und fachlichen Buchungszielen
- eine oder mehrere bestätigungspflichtige, centgenaue Aufteilungen pro Buchung
- gemeinsame Aufteilungen mit `target="household"` und optional `area="Hunde"`

Im aktuellen Arbeitsstand zusätzlich umgesetzt, aber noch nicht als Release
veröffentlicht:

- eigene Planposten-Verwaltung mit Einnahmen, Ausgaben und Rücklagen
- wiederkehrende und einmalige Planungen mit Fälligkeit und Gültigkeitszeitraum
- authentifizierte Planposten-API mit reversibler Archivierung
- lokale Tierprofile mit stabilem Schlüssel, optionalem Tier-Typ und reversibler Archivierung
- optionale Tier-Snapshots in Planposten und Buchungsaufteilungen, unabhängig von `target`

Weitere Produktfähigkeiten und Leitplanken:

- Unterstützung eines gemeinsamen Haushalts mit mehreren Personen
- Personenreferenzen aus Home-Assistant-`person.*`-Entitäten
- mehrere Kontoinhaber pro Bankkonto
- eine oder mehrere Aufteilungen pro Buchung
- gemeinsame Bereiche wie „Hunde“
- frei verwaltbare Kategorien und Projekte
- geplante Einnahmen, Ausgaben, Rücklagen und einmalige Sonderzahlungen
- Gehalt als Erwerbseinkommen
- PV-Erlöse und zugehörige Kosten im Projekt „PV-Anlage“
- manuelle Importe von MT940 und CAMT.053
- Duplikaterkennung, Importhistorie und Prüfliste
- Excel-Migration aus der bereitgestellten Vorlage
- Monats-, Jahres- und Cashflow-Auswertungen
- Kennzahlen als Home-Assistant-Sensoren
- Installation und Updates über HACS
- EUR als erste Währung
- lokale Verarbeitung ohne Bankzugangsdaten
- keine direkte Open-Banking-Anbindung in der ersten Version
- keine automatische Überwachung eines Dateiordners in der ersten Version
- keine echten Finanzdaten im öffentlichen Repository
- regelbasierte Vorschläge und automatische Zuordnung von Buchungen sind noch nicht geliefert

Die Begriffe „Planposten“, „Buchung“, „Aufteilung“, „Bereich“, „Kategorie“, „Projekt“, „Person“ und „Haushalt“ bilden die zentrale Fachsprache der Anwendung.

## Evidence on Hand

- Excel-Referenz: `template/Finanzplan Template.xlsx`
- Architekturentwurf: `docs/superpowers/specs/2026-09-14-ha-finanzplaner-design.md`
- GitHub-Repository: `ThePatzen/ha-finanzplaner`

Die Excel-Datei enthält private Finanzdaten und bleibt aus dem öffentlichen Repository ausgeschlossen. Es liegen noch keine anonymisierten Bankdateien, Screenshots, Markenassets, Nutzerinterviews oder Nutzungsmetriken vor.

## Product Principles

1. Planung und tatsächliche Buchungen bleiben getrennte, aber vergleichbare Daten.
2. Zahlungsquelle, Personenzuordnung und fachlicher Zweck bleiben unabhängig voneinander.
3. Der Haushalt kann eine Buchung nachvollziehbar auf mehrere Personen, Bereiche und Projekte aufteilen.
4. Die Anwendung verarbeitet Finanzdaten lokal und macht Importe sowie Korrekturen nachvollziehbar.
5. Die Bedienung fügt sich in Home Assistant ein und benötigt keine parallele Konten- oder Personenverwaltung.
