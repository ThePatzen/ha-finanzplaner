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

Mit Version 0.3.1 geliefert:

- automatische lokale Kontoerkennung aus CAMT.053 und MT940
- Kontenpflege mit mehreren Home-Assistant-Personen oder `Haushalt` als Kontoinhaber
- klare Trennung von Kontoinhabern und fachlichen Buchungszielen
- eine oder mehrere bestätigungspflichtige, centgenaue Aufteilungen pro Buchung
- gemeinsame Aufteilungen mit `target="household"` und optional `area="Hunde"`

Mit Version 0.3.2 verbessert:

- Verwaltungsansichten nutzen die verfügbare Inhaltsbreite und richten Header-Aktionen am rechten Rand aus.
- Buttons mit SVG-Icons halten Icon und Beschriftung in allen Ansichten horizontal zusammen.

Zusätzlich enthalten:

- eigene Planposten-Verwaltung mit Einnahmen, Ausgaben und Rücklagen
- wiederkehrende und einmalige Planungen mit Fälligkeit und Gültigkeitszeitraum
- authentifizierte Planposten-API mit reversibler Archivierung
- lokale Tierprofile mit stabilem Schlüssel, optionalem Tier-Typ und reversibler Archivierung
- optionale Tier-Snapshots in Planposten und Buchungsaufteilungen, unabhängig von `target`
- lokale Futterprofile mit Verpackungseinheit, erwarteten Kaufkosten, Verbrauchsintervall und Vorwarnfenster
- nächste Kaufprognose aus manuellem Intervall oder durchschnittlichem Abstand bestätigter Käufe
- bestätigte Futterkäufe verschieben das letzte Kaufdatum; erwartete Käufe werden einmalig in der Monatsprognose berücksichtigt
- Futter-Erinnerungsstatus als automationstauglicher Binary-Sensor und HA-Service zur Kaufbestätigung
- lokal verwaltete Stammdaten für Kategorien, Bereiche und Projekte mit stabilen IDs und historischen Namens-Snapshots
- Regelverwaltung für Buchungsvorschläge mit aktiven und deaktivierten Regeln, Priorität und Aufteilungsvorlage
- Finanzplaner trimmt und normalisiert Konto-IDs und vergleicht sie anschließend exakt. Beim optionalen Zahlungsempfänger normalisiert Finanzplaner den Leerraum, vergleicht den vollständigen Text exakt und ignoriert die Groß- und Kleinschreibung.
- optionaler Verwendungszweckfilter, der nur Buchungen mit dem angegebenen Textabschnitt berücksichtigt; jede Regel benötigt mindestens eine Bedingung aus Konto, Zahlungsempfänger oder Verwendungszweckfilter
- ein Vorschlag pro Buchung aus der Regel mit der höchsten Priorität; Regeln mit gleicher höchster Priorität erzeugen einen Konfliktstatus
- ausdrückliche Übernahme eines Vorschlags in den Entwurf und anschließende Bestätigung der Aufteilung durch den Nutzer
- Regelvorlage aus einer bestätigten Buchung über „Als Regel speichern“
- ungültige passende Regeln mit höchster Priorität halten die Buchung mit konkretem Prüfgrund ungeklärt; es erfolgt kein Rückgriff auf niedrigere Prioritäten
- aus bestätigten Buchungen vorbelegte Regeln lassen sich vor der ausdrücklichen Speicherung korrigieren; der Server validiert den bearbeiteten Entwurf

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
- Regelvorschläge beziehen sich auf offene Buchungen. „Vorschlag übernehmen“ füllt nur den Entwurf; erst „Aufteilung speichern“ bestätigt die Buchung.
- Regeländerungen und deaktivierte Regeln verändern bestehende bestätigte Buchungsaufteilungen nicht rückwirkend.
- Vollständige Kontoreferenzen bleiben im lokalen Speicher; Panel und API zeigen Kontodaten nur maskiert.
- keine direkte Open-Banking-Anbindung in der ersten Version
- keine automatische Überwachung eines Dateiordners in der ersten Version
- keine echten Finanzdaten im öffentlichen Repository

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
