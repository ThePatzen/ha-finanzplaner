---
name: impeccable-project
description: Verbindliche Design- und UX-Leitplanke für die Finanzplaner-Oberfläche. Verwende diese Projektregel bei jeder Entscheidung zu HTML, CSS, clientseitigem JavaScript, Layout, Navigation, Formularen, Tabellen, Zuständen, Barrierefreiheit oder visueller Politur und führe dabei immer $impeccable ein.
---

# Finanzplaner Design

Bei jeder Designentscheidung im Finanzplaner zuerst `$impeccable` verwenden. Das gilt auch für kleine UI-Korrekturen, neue Zustände und rein technische Änderungen an Frontend-Markup oder CSS, wenn sie die Bedienung oder Darstellung beeinflussen.

## Verbindlicher Ablauf

1. Projektkontext und bestehende Oberfläche prüfen. `PRODUCT.md`, vorhandene Design-Artefakte und die betroffene Frontend-Datei lesen; die bestehende visuelle Sprache, Fachbegriffe und Bedienlogik erhalten.
2. `$impeccable` mit dem passenden Modus verwenden. Für die Finanzplaner-App ist grundsätzlich `Operate` maßgeblich: klare Aufgabenführung, scanbare Dichte, stabile Struktur, verständliche Zustände und zugängliche native Bedienelemente.
3. Vor dem Editieren die Layout-Hypothese festlegen: primärer Bedienweg, Gruppierung, Hierarchie, responsive Verhalten, Tastaturreihenfolge sowie leere, Lade-, Fehler- und deaktivierte Zustände.
4. Frontend-Änderungen mit semantischem HTML, sichtbarem Fokus, ausreichendem Kontrast, echten Labels und brauchbaren Touch-Zielen umsetzen. Keine Icons oder visuellen Elemente als Ersatz für verständliche Beschriftungen.
5. Nach dem Editieren in einem gebündelten Durchlauf prüfen: relevante Tests, Syntax, `git diff --check` und den Impeccable-Detector für die geänderten UI-Dateien. Ungeklärte Befunde beheben oder im Übergabestatus begründen.

## Projektregeln

- Bestehende Produktwahrheit, API-Verträge, Fachsprache und Home-Assistant-Einbettung bewahren.
- Übersichtsansichten zuerst zeigen; Editieransichten erst durch eine eindeutige Nutzeraktion öffnen.
- Formulare müssen Zustände für unverändert, geändert, speichernd, gespeichert, fehlerhaft und deaktiviert klar unterscheiden.
- Tabellen semantisch mit Caption, Spaltenüberschriften und Zeilenüberschriften strukturieren; auf schmalen Flächen horizontal nutzbar bleiben.
- Verfügbare Breite nutzen, ohne Lesbarkeit, Gruppierung oder responsive Reflow zu opfern.
- `$impeccable` nicht durch persönliche Stilpräferenzen ersetzen. Wenn der Launcher nicht verfügbar ist, den Projektkontext direkt lesen und den Detector sowie die vorhandenen Tests als Fallback verwenden.
- Eine neue Version nur nach ausdrücklicher Versionsfreigabe erstellen; dafür den Projekt-Skill `version-release` verwenden.

## Übergabe

Kurz dokumentieren, welche Impeccable-Prüfung angewendet wurde, welche UX-/Layout-Entscheidung daraus entstand und welche automatisierten Prüfungen erfolgreich waren.
