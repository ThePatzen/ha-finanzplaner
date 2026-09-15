# Finanzplaner für Home Assistant

Lokaler Finanzplan für gemeinsame Haushalte — mit Planwerten, Prognose, echten Bankbuchungen und nachvollziehbaren Zuordnungen.

## Aktueller Stand

Die erste vertikale Scheibe ist vorbereitet:

- HACS-fähige Custom Integration mit Config Flow
- native Home-Assistant-Seitenleiste mit schneller Monatsübersicht
- Plan · Prognose · Ist und offene Buchungen als zentrale Sicht
- Home-Assistant-`person.*`-Entitäten als Personenquelle
- MT940- und CAMT.053-Upload mit Duplikatfingerprint
- Excel-Vorlage als prüfbare Vorschau mit Auswahl und Zuordnungsänderungen
- gemeinsame Zuordnungen wie `Haushalt` und `Hunde` im Datenmodell
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

## Excel-Plan übernehmen

1. Finanzplaner öffnen und `Buchungen prüfen` auswählen.
2. Die bisherige `.xlsx`-Finanzplanvorlage hochladen.
3. Vorschläge, Beträge, Richtung, Kategorie, Bereich, Projekt und Personenhinweis prüfen; nicht gewünschte Zeilen abwählen.
4. Mit `Planposten übernehmen` bestätigen oder die Vorschau verwerfen.

Die Arbeitsblätter `Einnahmen`, `Ausgaben` und `Sparen  und Rücklagen` werden in Planposten mit Monatsrhythmus übersetzt. `Gehalt`, PV-Erlöse, `Hunde`, Urlaubsgeld und die linke EMX-Kalkulation erhalten passende Prüfhinweise bzw. Vorschläge. `Übersicht` wird nicht importiert. Formelwerte, historische Urlaubsgeldwerte und Abweichungen der EMX-Vergleichstabelle bleiben als Warnungen sichtbar. Die Originaldatei und ihre Bytes werden nicht gespeichert.

## Fachliche Leitplanken

Ein Konto kann mehreren Personen gehören. Das beschreibt die Zahlungsquelle, nicht automatisch die fachliche Zuordnung. Jede Buchung kann auf eine oder mehrere Personen, `Haushalt`, den gemeinsamen Bereich `Hunde`, Kategorien und Projekte aufgeteilt werden. Gehalt wird als `Einnahmen / Erwerbseinkommen / Gehalt` geführt; PV-Erlöse als `Einnahmen / Energieerlöse / PV-Erlöse` im Projekt `PV-Anlage`.

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
