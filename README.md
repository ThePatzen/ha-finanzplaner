# Finanzplaner für Home Assistant

Lokaler Finanzplan für gemeinsame Haushalte — mit Planwerten, Prognose, echten Bankbuchungen und nachvollziehbaren Zuordnungen.

![Finanzplaner – gemeinsamer Haushaltsüberblick](assets/finanzplaner-hacs.png)

## Aktueller Stand

Version 0.3.0 liefert die erste durchgängige Konten- und Aufteilungsstrecke:

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
- wiederkehrende und einmalige Planungen mit Betrag, Rhythmus, Fälligkeit und Gültigkeitszeitraum
- centgenaue, bestätigungspflichtige Aufteilungen auf Personen oder `Haushalt`
- gemeinsame Zuordnungen wie `Haushalt` mit dem Bereich `Hunde`
- lokale Versionierung über Home Assistants persistenten Store
- ausgewählte Übersichtswerte als HA-Sensoren

Die Integration zeigt bei einem leeren Workspace klar markierte synthetische Demo-Daten. Private Konten, Bankdateien und die ursprüngliche Excel-Datei gehören nicht in dieses öffentliche Repository.

## Installation über HACS

1. HACS → Integrationen → Drei-Punkte-Menü → Benutzerdefiniertes Repository.
2. `https://github.com/ThePatzen/ha-finanzplaner` als Integration hinzufügen.
3. Finanzplaner installieren und Home Assistant neu starten.
4. Einstellungen → Geräte & Dienste → Integration hinzufügen → Finanzplaner.
5. Einen gemeinsamen Haushaltsnamen vergeben.

Danach erscheint Finanzplaner in der Home-Assistant-Seitenleiste. MT940- und CAMT.053-Dateien werden bewusst manuell in der Prüfliste hochgeladen; Originaldateien werden nicht dauerhaft gespeichert.

## Planposten verwalten

Über `Planposten` lassen sich neue Einnahmen, Ausgaben und Rücklagen direkt im Finanzplaner anlegen. Ein Planposten kann monatlich, in längeren Abständen oder einmalig gelten und optional einen Fälligkeitstag, ein Datum sowie einen Gültigkeitszeitraum erhalten. Kategorien, Bereiche, Projekte und ein Planungsziel (`Haushalt` oder eine vorhandene Home-Assistant-Person) bleiben getrennt pflegbar.

Archivieren deaktiviert einen Planposten nur; der Eintrag bleibt erhalten und kann über den Aktiv-Schalter wieder eingeschaltet werden. Beträge werden als positive Eurobeträge gespeichert, die Richtung bestimmt ihre Wirkung in der Übersicht.

## Tiere zuordnen

Über `Tiere` lassen sich lokale Profile wie `Fio` mit einem optionalen Tier-Typ
anlegen, bearbeiten und archivieren. Ein Tier ist keine Home-Assistant-Person.
Planposten und Buchungsaufteilungen können die stabile `pet_id` zusätzlich zum
unabhängigen Ziel `Haushalt` oder einer Person speichern. Der damalige Tiername
und Tier-Typ bleiben als Snapshot erhalten, auch wenn das Profil später
archiviert wird. Verbrauchsintervalle und automatische Futterprognosen folgen
in einem nächsten Ausbauschritt.

## Konten und Bankimport

Beim Import einer CAMT.053- oder MT940-Datei erkennt Finanzplaner das verwendete Konto automatisch und verknüpft neue Buchungen mit diesem Konto. Vollständige IBANs bleiben ausschließlich im lokalen Speicher; die Oberfläche und API-Antworten zeigen nur maskierte Kontoangaben. Unbekannte Konten werden ohne automatische Zuordnung angelegt und können anschließend in der Ansicht `Konten` benannt, archiviert und mit mehreren Kontoinhabern gepflegt werden.

Kontoinhaber und Zuordnungsziele stammen aus den vorhandenen Home-Assistant-`person.*`-Entitäten; zusätzlich steht `Haushalt` für gemeinsame Konten und Ausgaben bereit. Kontoinhaber beschreiben nur die Zahlungsquelle. Sie werden nicht automatisch auf bestehende oder neue Buchungen übertragen.

## Buchungen aufteilen

Importierte Buchungen werden in `Buchungen prüfen` bewusst bestätigt. Dort lässt sich der Betrag centgenau auf eine oder mehrere Personen beziehungsweise `Haushalt` verteilen. Jede Zeile kann zusätzlich Tier, Bereich, Kategorie und Projekt tragen; eine gemeinsame Futterausgabe wird beispielsweise als Ziel `Haushalt` mit Tier `Fio` und Bereich `Haustiere` gespeichert. Finanzplaner akzeptiert die Aufteilung erst, wenn die positiven Teilbeträge den absoluten Buchungsbetrag exakt abdecken. Automatische Regelvorschläge und Verbrauchsprognosen sind nicht Bestandteil dieser Version.

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
