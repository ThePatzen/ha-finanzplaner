# Änderungsprotokoll

Alle wichtigen Änderungen am Finanzplaner werden hier dokumentiert.

Das Projekt verwendet Semantic Versioning:

- `MAJOR`: inkompatible Änderungen an Datenmodell oder Bedienung
- `MINOR`: neue rückwärtskompatible Funktionen
- `PATCH`: Fehlerkorrekturen und kleine Verbesserungen

## Unreleased

## [0.7.0] – 2026-09-17

- Ungeklärte Buchungen zeigen das erkannte Konto jetzt mit Kontonamen und maskierter Referenz klar getrennt vom Zuordnungsziel.
- Monatsübersicht um einen Budget-Ist-Vergleich für Bereiche, Kategorien und Projekte erweitert; die Tabelle zeigt Plan, Prognose, Ist und Abweichung.
- Vergleichszeilen öffnen eine Inline-Detailansicht mit den passenden Planposten und Buchungen; Buchungen zeigen den zugeordneten Teilbetrag.
- Monatsverlauf proportional skaliert und den zugänglichen Chart-Inhalt gegen sichtbaren Textüberlauf abgesichert.

## [0.6.0] – 2026-09-17
- Buchungen können in der Prüfliste und der Ansicht übernommener Buchungen per Checkbox einzeln oder vollständig ausgewählt und dauerhaft gelöscht werden.

## [0.5.0] – 2026-09-17

- Eindeutige, gültige Regeltreffer werden beim Import automatisch übernommen; gleichrangige Regelkonflikte und ungeklärte Treffer bleiben in der Prüfliste.
- Die Prüfliste bietet `Regeln erneut anwenden`, um nach neuen oder geänderten Regeln offene Buchungen erneut zu prüfen.
- Übernommene Buchungen sind in einer eigenen Ansicht vollständig einsehbar; automatische Zuordnungen speichern die zutreffende Regel als Snapshot mit Treffergrund.
- Eine Zuordnung kann rückgängig gemacht werden und landet wieder als ungeklärte Buchung in der Prüfliste.

## [0.4.1] – 2026-09-17

- Zahlungsempfänger in Regeln optional gemacht, damit importierte Buchungen ohne getrennt gelieferten Empfänger als Konto- oder Verwendungszweckregel gespeichert werden können
- Prüfliste zeigt Zahlungsempfänger und Verwendungszweck getrennt und kennzeichnet fehlende Zahlungsempfänger ausdrücklich
- Globale Feedbackmeldungen erscheinen in allen Ansichten als kurzlebiger, zugänglicher Popup-Presenter mit explizitem Schließen und Browser-Fallback.
- Der interne Zielwert `household` wird in der Oberfläche überall als „Haushalt“ angezeigt; API- und Speicherwerte bleiben unverändert.
- Excel-Bestätigungsfeedback bleibt nach dem Aktualisieren der Monatsübersicht erhalten.
- Monatsverlaufsdiagramm erhält auf großen und kleinen Ansichten mehr vertikalen Raum.

## [0.4.0] – 2026-09-17

- Regelverwaltung für Buchungsvorschläge mit aktiven, deaktivierten und priorisierten Regeln ergänzt
- Konto- und Zahlungsempfänger-Matching präzisiert: Finanzplaner trimmt und normalisiert Konto-IDs und vergleicht sie anschließend exakt. Beim Zahlungsempfänger normalisiert Finanzplaner den Leerraum, vergleicht den vollständigen Text exakt und ignoriert die Groß- und Kleinschreibung; der Verwendungszweckfilter bleibt optional
- Vorschläge mit höchster Priorität und ein sichtbarer Konfliktstatus bei gleicher Priorität ergänzt
- `Vorschlag übernehmen` übernimmt die Aufteilung nur in den Entwurf; `Aufteilung speichern` verlangt die ausdrückliche Bestätigung
- `Als Regel speichern` erstellt aus einer bestätigten Buchung eine prüfbare Regelvorlage; Regeländerungen wirken nicht rückwirkend auf bestätigte Aufteilungen
- Regelverarbeitung bleibt lokal; Kontodaten erscheinen in Panel und API nur maskiert
- Opaque IDs bleiben an der Maskierungsgrenze erhalten; lange Buchungstexte und ungültige Spitzenregeln werden beim Matching korrekt behandelt, mit Begründung der tatsächlich verwendeten Bedingungen
- Regelgrenzen für Text, Priorität und Prozentgenauigkeit in API und Formular angeglichen; korrigierte Vorlagen aus bestätigten Buchungen lassen sich ausdrücklich speichern
- Energie, Kalender, Aufgaben, Haushalt und Personen als nutzbare Übersichtsansichten ergänzt
- Mehrere MT940- und CAMT.053-Buchungsdateien können gemeinsam als geprüftes ZIP importiert werden
- ZIP-Bankimporte erlauben bis zu 500 Dateien für umfangreiche Jahresimporte

## [0.3.4] – 2026-09-16

- Live-Dashboard ergänzt um echte Haushalts-, Bereichs- und Kategorieauswertungen sowie Monatsverlauf aus Planposten, Buchungen und Futterprognosen
- Import → Zuordnung → Übersicht als durchgängigen API-Workflow abgesichert
- Ungespeicherte Änderungen werden beim Verlassen einer Bearbeitungsansicht und beim Schließen des Browsers geschützt

## [0.3.3] – 2026-09-16

- Planposten, Tiere, Futterprofile, Stammdaten und Konten starten mit einer tabellarischen Übersichtsansicht
- Editierformulare werden erst nach „Bearbeiten“ oder „Anlegen“ geöffnet und führen nach dem Speichern zurück zur Übersicht
- Tabellen nutzen semantische Spaltenüberschriften, zugängliche Captions und responsive horizontale Darstellung

## [0.3.2] – 2026-09-16

- Tier-Neuanlage bleibt nach erfolgreichem Speichern wieder aktiv
- SVG-Icons stehen in Buttons aller Ansichten neben dem jeweiligen Text
- Verwaltungsansichten nutzen die verfügbare Inhaltsbreite; Header-Aktionen werden am rechten Rand ausgerichtet

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
[0.3.1]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.3.1
[0.3.2]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.3.2
[0.3.3]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.3.3
[0.3.4]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.3.4
[0.4.1]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.4.1
[0.4.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.4.0
[0.7.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.7.0
[0.6.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.6.0
