# Budget-Ist-Vergleich – Fachliche Spezifikation

**Stand:** 2026-09-17  
**Status:** Umsetzung im Feature-Worktree  
**Repository:** `ThePatzen/ha-finanzplaner`

## Ziel

Die Finanzübersicht soll nicht nur die Haushaltsgesamtsumme, sondern auch die
fachlichen Treiber der Abweichung zeigen. Für den ausgewählten Monat werden
Plan, Prognose und Ist je Bereich, Kategorie und Projekt vergleichbar. Nutzer
können eine Zeile öffnen und die dazugehörigen Planposten und Buchungen prüfen.

## Ausgangslage

- `overview_values` liefert bereits den kompatiblen Monatsvertrag für Panel und
  Home-Assistant-Sensoren.
- `overview_details` liefert bereits Haushaltswerte, Monatsverlauf sowie
  begrenzte Bereichs- und Kategorieauswertungen mit Plan und Ist.
- Die Oberfläche zeigt Bereiche und Kategorien derzeit als rein visuelle
  Kurzlisten. Projekte und eine Detailansicht fehlen.
- Planposten und Buchungen bleiben lokale Store-Daten; die neue Auswertung darf
  den Store beim Lesen nicht verändern.

## Umfang

Die erste Ausbaustufe umfasst:

- eine neue, abwärtskompatible Vergleichsprojektion für Bereiche, Kategorien
  und Projekte
- Plan, Prognose, Ist, Planabweichung und Prognoseabweichung je Eintrag
- eine nachvollziehbare Prozentabweichung, sofern ein Planwert vorhanden ist
- eine authentifizierte Detailabfrage für einen Eintrag im ausgewählten Monat
- eine Übersichtstabelle mit Umschaltung zwischen Bereich, Kategorie und
  Projekt
- eine Inline-Detailansicht mit den passenden Planposten und Buchungen
- leere, Lade-, Fehler- und Rückkehrzustände für die Detailansicht

## Nicht im Umfang

- keine Änderung an gespeicherten Planposten oder Buchungen
- keine neue persistente Store-Version
- keine automatische Bewertung, Kategorisierung oder Korrektur von Buchungen
- keine Jahresansicht, Szenarien oder Report-Zeitplanung
- keine externe Chart-Bibliothek und keine neue Frontend-Abhängigkeit
- keine Änderung der bestehenden HA-Sensor-Namen

## Fachliches Modell

### Vergleichseintrag

Die neue Projektion verwendet für jede Dimension diese Struktur:

```text
ComparisonEntry {
  key: string                 # stabile Katalog-ID oder "__unassigned__"
  name: string
  plan: number               # normalisierter Monatswert, Vorzeichen erhalten
  forecast: number           # Ist plus noch erwarteter Monats-Cashflow
  actual: number             # gebuchte Buchungen im Monat, Vorzeichen erhalten
  variance: number            # Ist minus Plan
  forecast_variance: number   # Prognose minus Plan
  variance_percent: number | null
}
```

Die Prozentwerte berechnen sich als `variance / abs(plan) * 100` und bleiben
bei einem Planwert von null `null`. Einnahmen bleiben positiv, Ausgaben und
Rücklagen negativ. Die Darstellung benennt die Vorzeichen ausdrücklich; Farbe
allein trägt keine fachliche Aussage.

Planwerte verwenden weiterhin `plan_item_month_values`. Der Prognosewert je
Dimension addiert den Ist-Wert und den noch erwarteten Cashflow der passenden
Planposten. Die bestehende Futterprognose wird dem Eintrag „Nicht zugeordnet“
zugerechnet, wenn sie keine entsprechende fachliche Dimension trägt.

Ein Planposten oder eine Allocation ohne passende Dimension gehört zu
`__unassigned__` und wird als „Nicht zugeordnet“ angezeigt. Katalog-IDs haben
Vorrang vor historischen Namens-Snapshots.

## API

`GET /api/finanzplaner/overview` bleibt unverändert gültig und ergänzt die
Antwort um:

```json
{
  "comparison": {
    "areas": [],
    "categories": [],
    "projects": []
  }
}
```

`GET /api/finanzplaner/overview/breakdown?month=2026-09&dimension=categories&key=category-futter`
liefert:

```json
{
  "month": "2026-09",
  "dimension": "categories",
  "key": "category-futter",
  "name": "Futter",
  "plan_items": [
    {"id": "...", "name": "...", "amount": 100, "direction": "expense"}
  ],
  "bookings": [
    {"id": "...", "booking_date": "2026-09-03", "amount": -30,
     "purpose": "...", "matched_amount": -30}
  ]
}
```

Die erlaubten Dimensionen sind `areas`, `categories` und `projects`. Der
Schlüssel `__unassigned__` fragt nicht zugeordnete Werte ab. Der Endpunkt
filtert auf den ausgewählten Monat, ist authentifiziert, maskiert Kontodaten
über die bestehende Response-Grenze und verändert den Store nicht. Ungültige
Dimensionen oder fehlende Schlüssel liefern einen verständlichen 400-Fehler.

## Bedienung und Darstellung

Die bestehende synoptische Haushaltskarte bleibt der erste Blick. Unter dem
Monatsverlauf erhält der bisherige Bereichs-/Kategorieblock einen klar
benannten „Budget-Ist-Vergleich“. Drei native Buttons schalten die Tabelle
zwischen Bereiche, Kategorien und Projekte um. Jede Zeile zeigt Name, Plan,
Prognose, Ist und Abweichung; eine zusätzliche Detailaktion bleibt auch per
Tastatur erreichbar.

Die Detailansicht erscheint inline unterhalb der Tabelle. Sie enthält zwei
semantische Tabellen für Planposten und Buchungen sowie eine Schaltfläche
„Vergleich schließen“. Beim Öffnen werden die Daten authentifiziert geladen.
Währenddessen bleibt die Auswahl sichtbar; Fehler nennen das Problem und
bieten „Erneut laden“. Eine leere Dimension erklärt, wie wieder Daten erzeugt
werden können.

Auf schmalen Ansichten bleibt die Tabelle horizontal scrollbar und die
Dimensionen stapeln sich in sinnvoller Reihenfolge. Numerische Werte nutzen
die bestehende tabellarische Zifferndarstellung. Die Tabelle ist die
zugängliche Alternative zu allen visuellen Hervorhebungen.

## Qualitätssicherung

- Domain-Tests decken Plan, Prognose, Ist, Abweichungen, Prozentwerte,
  Vorzeichen, unzugeordnete Werte und Katalog-Snapshots ab.
- HTTP-Tests decken Authentifizierung, Dimensionen, Monatsfilter,
  Response-Maskierung und Store-Unverändertheit ab.
- Frontend-Tests decken Auswahlzustand, semantische Tabellen, Detail-Lade- und
  Fehlerzustand sowie die Verwendung von `fetchWithAuth` ab.
- Vor der Übergabe laufen der vollständige Python-Testlauf, der Node-Testlauf,
  JavaScript-Syntaxprüfung, `compileall`, `git diff --check` und der
  Impeccable-Detector.
