# Finanzplaner für Home Assistant

Lokaler Finanzplan für gemeinsame Haushalte — mit Planwerten, Prognose, echten Bankbuchungen und nachvollziehbaren Zuordnungen.

![Finanzplaner – gemeinsamer Haushaltsüberblick](assets/finanzplaner-hacs.png)

## Aktueller Stand

Version 0.6.0 umfasst die automatische Übernahme eindeutiger Buchungsregeln, die vollständige Übernahmesicht
mit den folgenden Erweiterungen und UI-Verbesserungen:

- HACS-fähige Custom Integration mit Config Flow
- native Home-Assistant-Seitenleiste mit schneller Monatsübersicht
- Plan · Prognose · Ist und offene Buchungen als zentrale Sicht
- Home-Assistant-`person.*`-Entitäten als Personenquelle
- MT940- und CAMT.053-Upload mit Duplikatfingerprint
- automatische Kontoerkennung aus CAMT.053-IBAN beziehungsweise MT940-Kontoangabe
- Kontenpflege mit Anzeigename, mehreren Kontoinhabern und Archivstatus
- Excel-Vorlage als prüfbare Vorschau mit Auswahl und Zuordnungsänderungen
- eigene Planposten-Ansicht zum Anlegen, Bearbeiten und Archivieren von Einnahmen, Ausgaben und Rücklagen
- eigene Tierprofile mit optionalem Tier-Typ und historischer Snapshot-Zuordnung
- Futterprofile je Tier mit Kaufkosten, Verbrauchsintervall und nächster Kaufprognose
- Stammdatenverwaltung für Kategorien, Bereiche und Projekte mit stabilen IDs und Namens-Snapshots
- breite Verwaltungsansichten mit ausgenutzter Inhaltsbreite und konsistenter Button-Ausrichtung
- tabellarische Übersichten für alle Verwaltungsbereiche mit nachgelagerter Editieransicht
- automationstauglicher HA-Status `Futterkauf fällig` und Service zum Bestätigen eines Kaufs
- wiederkehrende und einmalige Planungen mit Betrag, Rhythmus, Fälligkeit und Gültigkeitszeitraum
- centgenaue, bestätigungspflichtige Aufteilungen auf Personen oder `Haushalt`
- gemeinsame Zuordnungen wie `Haushalt` mit dem Bereich `Hunde`
- Regelverwaltung mit Konto-, Zahlungsempfänger- und optionalem Verwendungszweck-Matching
- priorisierte Regelübernahmen nur bei eindeutigen Treffern, mit sichtbarer Zuordnungsquelle und Rückgängig-Funktion
- Prüfliste mit erneutem Regel-Lauf sowie separate Ansicht für sämtliche übernommene Buchungen
- Buchungen lassen sich in der Prüfliste und der Übernahmesicht per Checkbox einzeln oder vollständig auswählen und dauerhaft löschen
- lokale Versionierung über Home Assistants persistenten Store
- ausgewählte Übersichtswerte als HA-Sensoren

### Unreleased

Die noch nicht veröffentlichte Erweiterung ergänzt die Monatsübersicht um den
Budget-Ist-Vergleich. Er zeigt die Werte des ausgewählten Monats je Bereich,
Kategorie oder Projekt. Über die drei Schaltflächen wechselst du die Dimension.
Mit `Details` öffnest du unter der Tabelle eine Inline-Ansicht mit den passenden
Planposten und Buchungen. Planposten zeigen Betrag, Richtung und Rhythmus;
Buchungen zeigen den zugeordneten Teilbetrag. In Demo-Daten sind
Detailbuchungen nicht verfügbar.

Die Integration zeigt bei einem leeren Workspace klar markierte synthetische Demo-Daten. Private Konten, Bankdateien und die ursprüngliche Excel-Datei gehören nicht in dieses öffentliche Repository.

## Installation über HACS

[![Repository in HACS öffnen](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=ThePatzen&repository=ha-finanzplaner&category=integration)

1. HACS → Integrationen → Drei-Punkte-Menü → Benutzerdefiniertes Repository.
2. `https://github.com/ThePatzen/ha-finanzplaner` als Integration hinzufügen.
3. Finanzplaner installieren und Home Assistant neu starten.
4. Einstellungen → Geräte & Dienste → Integration hinzufügen → Finanzplaner.
5. Einen gemeinsamen Haushaltsnamen vergeben.

Danach erscheint Finanzplaner in der Home-Assistant-Seitenleiste. MT940- und CAMT.053-Dateien werden bewusst manuell in der Prüfliste hochgeladen; Originaldateien werden nicht dauerhaft gespeichert.

## Planposten verwalten

Über `Planposten` lassen sich neue Einnahmen, Ausgaben und Rücklagen direkt im Finanzplaner anlegen. Ein Planposten kann monatlich, in längeren Abständen oder einmalig gelten und optional einen Fälligkeitstag, ein Datum sowie einen Gültigkeitszeitraum erhalten. Kategorien, Bereiche und Projekte werden über `Stammdaten` gepflegt; Planposten speichern deren stabile ID und zusätzlich den damaligen Namen als Snapshot. Ein Planungsziel (`Haushalt` oder eine vorhandene Home-Assistant-`person.*`-Entität) bleibt davon getrennt.

Archivieren deaktiviert einen Planposten nur; der Eintrag bleibt erhalten und kann über den Aktiv-Schalter wieder eingeschaltet werden. Beträge werden als positive Eurobeträge gespeichert, die Richtung bestimmt ihre Wirkung in der Übersicht.

## Tiere zuordnen

Über `Tiere` lassen sich lokale Profile wie `Fio` mit einem optionalen Tier-Typ
anlegen, bearbeiten und archivieren. Ein Tier ist keine Home-Assistant-Person.
Planposten und Buchungsaufteilungen können die stabile `pet_id` zusätzlich zum
unabhängigen Ziel `Haushalt` oder einer Person speichern. Der damalige Tiername
und Tier-Typ bleiben als Snapshot erhalten, auch wenn das Profil später
archiviert wird. Verbrauchsintervalle und automatische Futterprognosen folgen
in der Ansicht `Futter`. Ein manuelles Intervall bleibt gegenüber dem
Durchschnitt bestätigter Käufe führend. Mit `Kauf heute bestätigen` wird die
Historie fortgeschrieben und der nächste voraussichtliche Kauf neu berechnet;
der erwartete Betrag zählt als konkretes Prognoseereignis und nicht noch einmal
als Monatsbudget. Der Home-Assistant-Sensor `Nächster Futterkauf` liefert das
nächste Datum sowie Status, Tier, Produkt und Berechnungsgrund als Attribute.
Der zusätzliche Binary-Sensor `Futterkauf fällig` wird bei bald fälligen,
heute fälligen oder überfälligen Profilen eingeschaltet. Seine Attribute
enthalten die betroffenen Profil-IDs und Kaufdaten, damit du in Home Assistant
eine eigene Benachrichtigung mit frei wählbarem Empfänger und Zeitplan anlegen
kannst. Der Service `finanzplaner.confirm_feed_purchase` bestätigt einen Kauf
auch aus einer HA-Aktion heraus. Es werden weder Bankbuchungen automatisch
erzeugt noch ungefragt Benachrichtigungen verschickt.

## Stammdaten

Über `Stammdaten` lassen sich Kategorien, Bereiche und Projekte anlegen,
umbenennen, archivieren und wieder aktivieren. Beim Umbenennen bleiben
bestehende Verknüpfungen über ihre stabile ID erhalten; gespeicherte Namen
bleiben als historische Snapshots verfügbar. Archivierte Einträge werden für
neue Zuordnungen nicht angeboten, bleiben in alten Buchungen aber sichtbar.

## Konten und Bankimport

Beim Import einer CAMT.053- oder MT940-Datei erkennt Finanzplaner das verwendete Konto automatisch und verknüpft neue Buchungen mit diesem Konto. Eindeutige, gültige Regeltreffer mit höchster Priorität werden dabei automatisch übernommen; Konflikte und ungeklärte Treffer bleiben in `Buchungen prüfen`. Mehrere solche Buchungsdateien können auch gemeinsam als ZIP-Datei importiert werden; das Archiv wird vor dem Speichern vollständig geprüft und darf maximal 500 Dateien beziehungsweise 10 MB entpackte Daten enthalten. Damit lassen sich beispielsweise Jahresdaten von fünf Konten mit je zwölf Monatsdateien gemeinsam importieren. Vollständige IBANs bleiben ausschließlich im lokalen Speicher; die Oberfläche und API-Antworten zeigen nur maskierte Kontoangaben. Unbekannte Konten werden ohne automatische Zuordnung angelegt und können anschließend in der Ansicht `Konten` benannt, archiviert und mit mehreren Kontoinhabern gepflegt werden.

Kontoinhaber und Zuordnungsziele stammen aus den vorhandenen Home-Assistant-`person.*`-Entitäten; zusätzlich steht `Haushalt` für gemeinsame Konten und Ausgaben bereit. Kontoinhaber beschreiben nur die Zahlungsquelle. Sie werden nicht automatisch auf bestehende oder neue Buchungen übertragen.

## Buchungsregeln

Öffne `Regeln` und wähle `Regel anlegen`, um eine Vorlage für künftige Buchungsvorschläge zu speichern. Vergib einen Namen und trage den vollständigen Zahlungsempfänger ein, sofern er bekannt ist. Wenn du ein Konto auswählst, grenzt die Regel die Zahlungsquelle auf genau dieses Konto ein. Finanzplaner trimmt und normalisiert die Konto-ID und vergleicht sie anschließend exakt. Der Zahlungsempfänger ist optional; wenn er fehlt, muss die Regel über ein Konto oder `Verwendungszweck enthält (optional)` eingeschränkt werden. Beim Zahlungsempfänger normalisiert Finanzplaner den Leerraum, vergleicht den vollständigen Text exakt und ignoriert die Groß- und Kleinschreibung. Eine Regelaufteilung enthält jedes Ziel höchstens einmal; ihre Anteile müssen zusammen 100 Prozent ergeben.

Für eine offene Buchung prüft Finanzplaner nur aktive Regeln. Wenn die Regel ein Konto festlegt, muss die Buchung genau diesem Konto entsprechen. Wenn die Regel einen Zahlungsempfänger festlegt, muss auch dieser vollständige Text passen; fehlt die Bedingung, wird sie nicht geprüft. Der optionale Verwendungszweckfilter muss zusätzlich zutreffen. Die Regel mit der höchsten Priorität liefert den Vorschlag. Treffen mehrere Regeln mit gleicher höchster Priorität zu, zeigt die Prüfliste `Regelkonflikt` an; die Buchung wird nicht automatisch übernommen. Ein eindeutiger Treffer wird nur übernommen, wenn seine Aufteilung serverseitig weiterhin gültig ist.

Regelnamen dürfen bis zu 120 Zeichen enthalten, Zahlungsempfänger und Verwendungszweckfilter jeweils bis zu 160. Die Priorität ist eine ganze Zahl von 0 bis 1000. Jeder Anteil liegt zwischen 0,01 und 100,00 Prozent und hat höchstens zwei Nachkommastellen. Lange Verwendungszwecke einer Buchung verhindern das Matching nicht. Ist eine passende Regel mit höchster Priorität ungültig, bleibt die Buchung mit dem konkreten Prüfgrund ungeklärt; eine niedrigere Regel übernimmt nicht ersatzweise.

Eindeutige Treffer werden beim Bankimport automatisch gespeichert. Die Buchung enthält dabei einen Snapshot aus Regel-ID, Regelname, Treffergrund und Übernahmezeitpunkt. Nach dem Anlegen oder Ändern einer Regel kannst du in `Buchungen prüfen` mit `Regeln erneut anwenden` alle derzeit ungeklärten Buchungen noch einmal auswerten. Bereits übernommene Buchungen werden dabei nicht verändert; Konflikte und ungeklärte Treffer bleiben zur manuellen Prüfung offen.

Nach einer bestätigten manuellen Aufteilung kannst du in der Prüfliste `Als Regel speichern` wählen. Finanzplaner öffnet daraus eine Regelvorlage mit Konto, dem bekannten Zahlungsempfänger und den bestätigten Anteilen. Ist kein Zahlungsempfänger importiert, bleibt das Feld leer; prüfe dann mindestens Konto oder Verwendungszweckfilter als Bedingung. Ergänze bei Bedarf den Verwendungszweckfilter und die Priorität und speichere die Vorlage mit `Regel speichern`. Regeländerungen wirken nicht rückwirkend auf bereits übernommene Buchungen.

Fehlende oder archivierte Zuordnungen und durch Umrechnung ungültige Prozentanteile kannst du im Entwurf korrigieren. Erst `Regel speichern` sendet die bearbeiteten Angaben zur serverseitigen Prüfung und speichert die neue Regel. Die ursprüngliche Buchung bleibt dabei unverändert.

In `Übernommene Buchungen` kannst du sämtliche automatisch und manuell übernommenen Buchungen einsehen. Die Zuordnungsquelle zeigt bei Regelübernahmen die verwendete Regel und ihren Treffergrund. `Zuordnung rückgängig` leert die Aufteilung und setzt die Buchung wieder auf ungeklärt; sie erscheint danach erneut in der Prüfliste und wird erst bei einem erneuten Regel-Lauf wieder automatisch geprüft.

In `Buchungen prüfen` und `Übernommene Buchungen` kannst du Buchungen per Checkbox markieren. `Alle auswählen` markiert die aktuell sichtbare Liste; `Auswahl löschen` entfernt die markierten Buchungen nach einer Sicherheitsbestätigung dauerhaft.

Regeln und Vorschläge verarbeitet Finanzplaner lokal in Home Assistant. Vollständige Kontoreferenzen bleiben im lokalen Speicher; Oberfläche und API zeigen nur maskierte Kontodaten.

## Buchungen aufteilen

Nicht eindeutig regelbare Buchungen werden in `Buchungen prüfen` bewusst bestätigt. Dort lässt sich der Betrag centgenau auf eine oder mehrere Personen beziehungsweise `Haushalt` verteilen. Jede Zeile kann zusätzlich Tier, Bereich, Kategorie und Projekt tragen; eine gemeinsame Futterausgabe wird beispielsweise als Ziel `Haushalt` mit Tier `Fio` und Bereich `Haustiere` gespeichert. Finanzplaner akzeptiert die Aufteilung erst, wenn die positiven Teilbeträge den absoluten Buchungsbetrag exakt abdecken. Auch automatisch übernommene Buchungen bleiben in der Ansicht `Übernommene Buchungen` nachvollziehbar und können dort wieder zur Prüfung geöffnet werden; Benachrichtigungen werden nicht ungefragt verschickt.

## Excel-Plan übernehmen

1. Finanzplaner öffnen und `Buchungen prüfen` auswählen.
2. Die bisherige `.xlsx`-Finanzplanvorlage hochladen.
3. Vorschläge, Beträge, Richtung, Kategorie, Bereich, Projekt und Personenhinweis prüfen; nicht gewünschte Zeilen abwählen.
4. Mit `Planposten übernehmen` bestätigen oder die Vorschau verwerfen.

Die Arbeitsblätter `Einnahmen`, `Ausgaben` und `Sparen  und Rücklagen` werden in Planposten mit Monatsrhythmus übersetzt. `Gehalt`, PV-Erlöse, `Hunde`, Urlaubsgeld und die linke EMX-Kalkulation erhalten passende Prüfhinweise bzw. Vorschläge. `Übersicht` wird nicht importiert. Formelwerte, historische Urlaubsgeldwerte und Abweichungen der EMX-Vergleichstabelle bleiben als Warnungen sichtbar. Die Originaldatei und ihre Bytes werden nicht gespeichert.

## Fachliche Leitplanken

Ein Konto kann mehreren Personen gehören. Das beschreibt die Zahlungsquelle, nicht automatisch die fachliche Zuordnung. Jede Buchung kann auf eine oder mehrere Personen oder `Haushalt` verteilt und je Aufteilungszeile mit dem gemeinsamen Bereich `Hunde`, Kategorien und Projekten ergänzt werden. Gehalt wird als `Einnahmen / Erwerbseinkommen / Gehalt` geführt; PV-Erlöse als `Einnahmen / Energieerlöse / PV-Erlöse` im Projekt `PV-Anlage`.

## Entwicklung

```bash
python3 -m unittest discover -s tests -v
node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs
node --check custom_components/finanzplaner/frontend/panel.js
python3 -m compileall -q custom_components
```

Der Markenlink `Home Assistant` führt aus dem Panel zurück zur normalen Home-Assistant-Oberfläche und berücksichtigt auch Installationen unter einem URL-Unterpfad.

## Versionierung

Die Versionsnummer steht in `custom_components/finanzplaner/manifest.json` und folgt
Semantic Versioning. Für einen HACS-Release werden Manifest, [CHANGELOG.md](CHANGELOG.md)
und ein Git-Tag im Format `vMAJOR.MINOR.PATCH` gemeinsam aktualisiert.

Die Designspezifikation liegt unter `docs/superpowers/specs/2026-09-14-ha-finanzplaner-design.md`.
