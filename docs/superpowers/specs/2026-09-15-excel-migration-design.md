# Excel-Migration – Fachliche Spezifikation

**Stand:** 2026-09-15  
**Status:** Freigegebenes Teilprojekt  
**Referenz:** `template/Finanzplan Template.xlsx`

## Ziel

Die bestehende private Finanzplan-Vorlage wird in strukturierte Planposten
überführt. Der Import ist nachvollziehbar, zeigt vor dem Speichern eine
Vorschau und behandelt berechnete oder historische Excel-Werte als Hinweise,
nicht als zusätzliche Finanzquellen.

Die Originaldatei bleibt lokal. Sie wird weder in der Integration gespeichert
noch in das öffentliche Repository übernommen.

## Eingabestruktur

Der Import erkennt diese Blätter anhand ihrer Namen:

| Blatt | Bedeutung | Importverhalten |
| --- | --- | --- |
| `Einnahmen` | Einnahmen und Kunden-/Aboerlöse | aktive Planposten |
| `Ausgaben` | laufende und jährliche Ausgaben | aktive Planposten |
| `Sparen  und Rücklagen` | Spar- und Rücklagenposten | aktive Planposten mit Richtung Rücklage |
| `Urlaubsgelder` | Sommer-/Winterurlaubsgeld je Person | jährliche Einnahme-Planposten |
| `EMX Calc` | projektbezogene Kalkulation | Projektposten aus der linken Haupttabelle |
| `Übersicht` | Excel-Summen und Formelergebnisse | nicht als Planposten importiert |

Fehlende optionale Blätter erzeugen einen Importhinweis. Fehlen die drei
Hauptblätter `Einnahmen`, `Ausgaben` und `Sparen  und Rücklagen`, wird der
Import abgebrochen.

## Normalisiertes Planpostenmodell

Der Import erzeugt zunächst Vorschlagsobjekte mit diesen Feldern:

```text
PlanItemSuggestion {
  id: string
  direction: income | expense | saving
  name: string
  category: string
  area: string | null
  project: string | null
  amount: Decimal
  frequency_months: 1 | 2 | 3 | 6 | 12 | null
  normalized_monthly: Decimal | null
  annual_amount: Decimal | null
  person_hint: string | null
  source_sheet: string
  source_row: int
  source_columns: list[string]
  source_formula: string | null
  warnings: list[string]
}
```

Die gespeicherten Planposten übernehmen die fachlich bestätigten Felder und
zusätzlich `source_sheet`, `source_row` sowie die bestätigte Importlauf-ID.
Beträge werden als positive Beträge gespeichert; die Richtung bestimmt, ob sie
bei der Berechnung addiert, abgezogen oder als Rücklage berücksichtigt werden.

## Rhythmus und Beträge

In `Einnahmen`, `Ausgaben` und `Sparen  und Rücklagen` werden die Spalten so
ausgewertet:

| Spalte | `frequency_months` | Bedeutung |
| --- | ---: | --- |
| `C` / `1 Monat` | 1 | monatlicher Betrag |
| `D` / `2 Monat` | 2 | Betrag alle zwei Monate |
| `E` / `3 Monat` | 3 | Betrag alle drei Monate |
| `F` / `6 Monat` | 6 | halbjährlicher Betrag |
| `G` / `12 Monat` | 12 | jährlicher Betrag |

Jeder nichtleere Rhythmuswert erzeugt einen eigenen Vorschlag. So bleiben
mehrere unterschiedliche Zahlungen derselben Excel-Zeile voneinander
unterscheidbar. `K` beziehungsweise `I` im Rücklagenblatt wird als
`normalized_monthly` übernommen, `L` beziehungsweise `J` als `annual_amount`.
Diese abgeleiteten Werte werden nicht erneut als eigene Zahlungen importiert.

Eine Zeile ohne Bezeichnung oder ohne einen nichtleeren Rhythmuswert wird
übersprungen und als leere beziehungsweise rein berechnete Zeile gezählt.
Nullwerte ohne Formel erzeugen keinen Planposten.

## Fachliche Normalisierung

- `Einnahmen` erzeugt `direction=income`.
- `Ausgaben` erzeugt `direction=expense`.
- `Sparen  und Rücklagen` erzeugt `direction=saving`.
- Excel-Kategorie und Bezeichnung bleiben erhalten.
- `Hundefutter` und `Hundesteuer` erhalten `area=Hunde`.
- Eine Bezeichnung mit `Gehalt` erhält `category=Gehalt` und die Gruppe
  `Erwerbseinkommen`.
- PV-Bezeichnungen mit `PV`, `Photovoltaik` oder `Solar` erhalten
  `category=PV-Erlöse` und `project=PV-Anlage`, sofern sie aus `Einnahmen`
  stammen. Die Zuordnung bleibt in der Vorschau änderbar.
- Eine Bezeichnung mit `EMX` oder ein Eintrag aus `EMX Calc` erhält
  `project=EMX`.
- Aus `person_hint` wird keine automatische HA-Personenzuordnung gespeichert.
  Die Vorschau darf einen Namens-Treffer vorschlagen; die Bestätigung bindet
  erst an die aktuell vorhandene `person.*`-Entität.

## Blatt `Urlaubsgelder`

Die Werte `B`/`C` sind die aktuellen Jahreswerte für David und Isabella. Aus
den Sommer- und Winterzeilen werden jährliche Einnahme-Planposten mit Bereich
`Urlaub` und dem jeweiligen `person_hint` erzeugt. `E`/`F` sind historische
2024-Vergleichswerte; sie werden nicht als aktive Planposten angelegt, sondern
als `historical_reference` im Importbericht festgehalten.

Die Summenzeilen werden nicht importiert, weil sie aus den Einzelzeilen
berechnet sind.

## Blatt `EMX Calc`

Die linke Tabelle `B:D` ist die primäre Kalkulation. Für jede benannte Zeile
mit einem Wert in `C` oder `D` wird ein Ausgabenposten mit `project=EMX`
erzeugt. `C` ist der normalisierte Monatswert, `D` der Jahreswert. Die rechte
Vergleichstabelle `I:K` und Summenzeilen werden nicht als zweite Finanzquelle
importiert. Abweichungen zwischen linker und rechter Tabelle werden als
`comparison_table_diff` im Importbericht ausgewiesen.

## Formeln und Prüfhinweise

Der XLSX-Reader liest sowohl den sichtbaren Zellwert als auch Formeln. Die
gespeicherten Cache-Werte dürfen für die Vorschau verwendet werden, aber jede
Formel in einem importierten Betrag erzeugt einen Hinweis:

- `formula_value`: Betrag stammt aus einer Excel-Formel und muss bestätigt
  werden.
- `derived_column`: Wert stammt aus `K`, `L`, `I` oder `J` und ist nur eine
  normalisierte Zusatzinformation.
- `historical_value`: Wert gehört zum historischen Vergleich 2024.
- `empty_calculation_row`: Zeile enthält nur Excel-Berechnungen ohne eigene
  Bezeichnung.
- `unmapped_category`: Excel-Kategorie hat noch keine Finanzplaner-Kategorie.

Formeln werden nicht evaluiert. Der XLSX-Cache ist eine Importquelle, die
Formel selbst bleibt als Prüftext erhalten. Dadurch benötigt die
Home-Assistant-Integration keine Excel-Laufzeit und keine zusätzliche
Python-Abhängigkeit.

## Vorschau und Bestätigung

Der Import läuft in zwei getrennten Schritten:

1. Datei hochladen und als nicht persistente Vorschau analysieren.
2. Vorschau mit Anzahl der Vorschläge, Summen, Warnungen und historischen
   Werten anzeigen.
3. Nutzer kann Vorschläge abwählen oder Richtung, Kategorie, Bereich, Projekt
   und Personenhinweis ändern.
4. Erst `Import bestätigen` schreibt die ausgewählten Planposten und den
   Importbericht in den versionierten Store.

Ein abgebrochener oder fehlerhafter Vorschau-Import verändert keine Daten.
Die Originaldatei wird nach der Analyse verworfen. Ein bestätigter Import ist
über seine Importlauf-ID und die Quellenzeile nachvollziehbar; identische
Vorschläge aus demselben Lauf werden nicht doppelt gespeichert.

## Technische Grenzen des Teilprojekts

- Keine Formelauswertung außerhalb der im XLSX gespeicherten Cache-Werte.
- Keine automatische Zuordnung unbekannter Namen zu Personen.
- Keine automatische Übernahme der Excel-Übersichtssummen.
- Keine historische Monatsbuchungserzeugung aus der Vorlage.
- Keine Änderung der Originaldatei.

Diese Grenzen halten die Migration sicher und nachvollziehbar. Konten,
Zuordnungsregeln, wiederkehrende Fälligkeitstermine und die vollständige
Planpostenbearbeitung bauen anschließend auf dem normalisierten Modell auf.

## Grundnavigation

Der Markenlink `Home Assistant` in der linken Leiste führt immer zurück in die
normale Home-Assistant-Oberfläche mit ihrem HA-Menü und der HA-Seitenleiste.
Er darf nicht nur auf den Anfang des Finanzplaner-Panels springen. Die
Ziel-URL wird aus der aktuellen Panel-URL base-path-sicher abgeleitet, damit
Installationen unter einem Unterpfad wie `/homeassistant/finanzplaner`
ebenfalls bei `/homeassistant/` landen.

Die Ziel-URL verwirft Query-Parameter und Hash-Fragmente. Die Funktion zur
URL-Ableitung liegt in der getesteten Frontend-Utility-Datei und erhält den
aktuellen Standort sowie den Panel-Pfad als Eingaben.

## Abnahmekriterien

- Alle drei Hauptblätter werden ohne `openpyxl` oder andere neue Laufzeit-
  Abhängigkeit gelesen.
- Eine Zeile mit Monats- und Jahreswert erzeugt zwei rhythmische Vorschläge,
  nicht einen doppelten Jahreswert.
- Formeln und historische Urlaubsgeldwerte erscheinen als Hinweise.
- `Gehalt`, PV-Erlöse, Hunde und EMX werden nach den obigen Regeln
  vorgeschlagen.
- Vorschau ändert den Store nicht; Bestätigung speichert nur ausgewählte
  Vorschläge.
- Der `Home Assistant`-Link führt vom Panel in die normale HA-Oberfläche mit
  ihrem Menü zurück und funktioniert auch unter einem konfigurierten
  URL-Unterpfad.
- Parser-, Normalisierungs- und Persistenzlogik sind mit anonymisierten
  XLSX-Fixtures getestet.
