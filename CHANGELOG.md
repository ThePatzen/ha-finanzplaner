# Änderungsprotokoll

Alle wichtigen Änderungen am Finanzplaner werden hier dokumentiert.

Das Projekt verwendet Semantic Versioning:

- `MAJOR`: inkompatible Änderungen an Datenmodell oder Bedienung
- `MINOR`: neue rückwärtskompatible Funktionen
- `PATCH`: Fehlerkorrekturen und kleine Verbesserungen

## [0.18.0] – 2026-09-19

- Erneute Bankimporte speichern Duplikate als eigene prüfbare Buchungen mit Status `duplicate` und Originalverweis.
- Die Regelliste zeigt potenzielle Konflikte aktiver Regeln gleicher Priorität samt Konfliktpartnern.

## [0.17.0] – 2026-09-18

- Die Navigation bündelt Buchungen, Planung und weitere Bereiche in sieben Hauptpunkten; Konten, Personen, Tiere und Stammdaten sind unter Haushalt → Verwalten erreichbar.
- Berichtsschalter in der Übersicht haben einen sichtbaren aktiven Zustand und zeigen nach dem Umschalten den gewählten Zeitraum nachvollziehbar an.
- Leere oder nicht erreichbare Live-Daten werden nicht mehr durch Demo-Kennzahlen ersetzt; stattdessen zeigt die Übersicht eine klare Fehlermeldung mit erneutem Ladeversuch.

## [0.16.0] – 2026-09-18

- Unterkategorien dürfen unter verschiedenen Hauptkategorien denselben Namen tragen, zum Beispiel „Haus → Gebühren“ und „Bank → Gebühren“.
- Auswahlfelder, Stammdaten, Regeln und Filter zeigen Unterkategorien mit ihrem vollständigen Pfad statt mit dem technischen Präfix „Unterkategorie ·“.
- Der Budget-Ist-Vergleich kann Kategorien entweder nach Struktur getrennt oder nach gleichem Namen zusammengefasst auswerten; die Detailansicht weist die beteiligten Quellpfade aus.

## [0.15.0] – 2026-09-18

- Kategorien unterstützen optional genau eine Unterkategorie-Ebene, die in Stammdaten- und Zuordnungsauswahl eingerückt angezeigt wird.

## [0.14.0] – 2026-09-18

- Übernommene Buchungen behalten das bekannte Konto des Kontoauszugs auch dann als richtungsrichtiges Absender- oder Empfängerkonto, wenn der CAMT-Satz kein Gegenkonto enthält; unbekannte Gegenkonten werden nicht erfunden.
- Buchungen und übernommene Buchungen werden in der Oberfläche nach Konto gruppiert.

## [0.13.1] – 2026-09-18

- Übernommene Buchungsdetails ergänzen fehlende Absender und Zahlungsempfänger aus auflösbaren internen Kontoreferenzen.
- Die gespeicherten unveränderten CAMT-/MT940-Quelldaten bleiben von dieser Anzeigeergänzung unberührt.

## [0.13.0] – 2026-09-18

- Prüfliste und Übernahmesicht teilen sich übersichtlich angeordnete Filter; beide Ansichten unterstützen blätterbare Seiten, wählbare Seitengrößen und „Alle“.

## [0.12.0] – 2026-09-18

- Bank-spezifische CAMT-Kontoreferenzen aus `DbtrAgt` und `CdtrAgt` werden bei internen Überweisungen erkannt, damit Absender- und Empfängerkonto auch in übernommenen Buchungen korrekt angezeigt werden.
- Die Regelansicht gruppiert Regeln nach Konto; die Konto-Spalte entfällt. Innerhalb der Gruppen werden Regeln wie beim Matching nach absteigender Priorität und danach alphabetisch nach Regelname sortiert.
- Die Buchungshistorie kann nach Suche, Zeitraum, Status, Konto und Kategorie gefiltert werden; die Importhistorie zeigt Dateiname, Format, Zeitpunkt sowie Buchungs- und Duplikatanzahl.
- Regeln unterstützen Richtung, maskiertes Gegenkonto und eine inklusive Betragsspanne mit Mindest- und Höchstbetrag.
- Die Übersicht bietet die Berichtsmodi `month`, `year` und `cashflow`; die Monatsansicht bleibt der Standard.
- Fehlende Home-Assistant-Personenziele werden als `Person fehlt` markiert und können mit einem verfügbaren Ersatzziel repariert werden.
- Die Übersichtssensoren umfassen Plan-/Ist-Restbetrag, geplante Einnahmen, Ausgaben und Rücklagen, Prognose, ungeklärten Betrag, Haushaltssaldo, nächste größere Zahlung, ungeklärte Buchungen und nächsten Futterkauf.

## [0.11.0] – 2026-09-18

- Interne Konten werden in ungeklärten und übernommenen Buchungen direkt neben Absender und Zahlungsempfänger angezeigt; das redundante Kontenpaar rechts entfällt.
- Beim Erstellen einer Regel aus einer übernommenen Buchung wird der vorhandene Verwendungszweck als vorbefüllter Verwendungszweckfilter übernommen.

## [0.10.0] – 2026-09-17

- CAMT-Kontoreferenzen werden gegen konfigurierte Konten abgeglichen und interne Überweisungen in Buchungen, Prüfliste sowie Buchungsdetails als Absenderkonto → Empfängerkonto angezeigt.
- Die Kontoreferenzen bleiben maskiert; Fingerprints und Regelmatching bleiben unverändert.
- Unveränderte Bank-Uploads werden pro Datei lokal aufbewahrt und können für ausgewählte Buchungen einzeln oder gesammelt als ZIP exportiert werden.

## [0.9.0] – 2026-09-17

- CAMT.053-Absender werden separat vom Zahlungsempfänger gespeichert und in Buchungen, Prüfliste sowie Buchungsdetails angezeigt.
- Bestehende CAMT-Buchungen werden beim Laden aus den gespeicherten Quelldaten nachangereichert; Duplikatfingerprints und Regelmatching bleiben unverändert.
- Fehlende MT940-Absender werden ausdrücklich als „Nicht vorhanden“ dargestellt.

## [0.8.1] – 2026-09-17

- CAMT.053-Lastschriften zeigen jetzt den Zahlungsempfänger statt des eigenen Kontoinhabers als Gegenpartei.

## [0.8.0] – 2026-09-17

- Buchungsdetails als Popup für ungeklärte und übernommene Buchungen
- verlustfreie Quelldatenansicht für importierte MT940-/CAMT.053-Buchungssätze

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
[0.12.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.12.0
[0.13.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.13.0
[0.13.1]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.13.1
[0.14.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.14.0
[0.15.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.15.0
[0.16.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.16.0
[0.18.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.18.0
[0.17.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.17.0
[0.11.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.11.0
[0.10.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.10.0
[0.9.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.9.0
[0.8.1]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.8.1
[0.8.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.8.0
[0.7.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.7.0
[0.6.0]: https://github.com/ThePatzen/ha-finanzplaner/releases/tag/v0.6.0
