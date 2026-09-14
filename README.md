# Finanzplaner für Home Assistant

Lokaler Finanzplan für gemeinsame Haushalte — mit Planwerten, Prognose, echten Bankbuchungen und nachvollziehbaren Zuordnungen.

## Aktueller Stand

Die erste vertikale Scheibe ist vorbereitet:

- HACS-fähige Custom Integration mit Config Flow
- native Home-Assistant-Seitenleiste mit schneller Monatsübersicht
- Plan · Prognose · Ist und offene Buchungen als zentrale Sicht
- Home-Assistant-`person.*`-Entitäten als Personenquelle
- MT940- und CAMT.053-Upload mit Duplikatfingerprint
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

## Fachliche Leitplanken

Ein Konto kann mehreren Personen gehören. Das beschreibt die Zahlungsquelle, nicht automatisch die fachliche Zuordnung. Jede Buchung kann auf eine oder mehrere Personen, `Haushalt`, den gemeinsamen Bereich `Hunde`, Kategorien und Projekte aufgeteilt werden. Gehalt wird als `Einnahmen / Erwerbseinkommen / Gehalt` geführt; PV-Erlöse als `Einnahmen / Energieerlöse / PV-Erlöse` im Projekt `PV-Anlage`.

## Entwicklung

```bash
python3 -m unittest discover -s tests -v
node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs
```

Die Designspezifikation liegt unter `docs/superpowers/specs/2026-09-14-ha-finanzplaner-design.md`.
