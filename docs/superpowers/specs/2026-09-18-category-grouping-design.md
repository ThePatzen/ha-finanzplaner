# Kategorien mit wiederverwendbaren Unterkategorien und Statistik-Gruppierung

## Ziel

Unterkategorien sollen unter verschiedenen Hauptkategorien denselben Namen
tragen dürfen. Dadurch sind zum Beispiel `Haus → Gebühren` und
`Bank → Gebühren` möglich. In der Statistik sollen diese Einträge je nach
Fragestellung entweder nach ihrer vollständigen Struktur getrennt oder nach
dem gemeinsamen Unterkategorienamen zusammengefasst werden können.

Die bestehende Funktion mit höchstens einer Unterkategorie-Ebene bleibt
erhalten. Die Änderung betrifft die Eindeutigkeit von Kategorien, ihre
Darstellung und die Auswertung im Budget-Ist-Vergleich.

## Ausgangslage und Probleme

- Unterkategorien werden aktuell mit dem technischen Präfix
  `Unterkategorie ·` angezeigt. Das wirkt in Auswahlfeldern und Übersichten
  uneinheitlich und macht die Hierarchie nicht direkt verständlich.
- Die Speicherung und die HTTP-Prüfung behandeln den Kategorienamen derzeit
  global als eindeutig. Deshalb kann derselbe Unterkategoriename nicht unter
  zwei verschiedenen Hauptkategorien angelegt werden.
- Die Statistik verwendet bisher die Kategorie-ID als Gruppenschlüssel. Zwei
  gleichnamige Unterkategorien unter verschiedenen Hauptkategorien würden
  daher nicht als gemeinsame Namensgruppe ausgewertet.

## Fachliches Verhalten

### Eindeutigkeit

Eine Kategorie ist innerhalb ihres Elternkontexts eindeutig:

```text
(parent_id, label.casefold())
```

Damit gelten folgende Regeln:

- `Haus → Gebühren` und `Bank → Gebühren` sind erlaubt.
- Zwei `Gebühren` direkt auf der obersten Ebene bleiben unzulässig.
- Zwei `Gebühren` unter derselben Hauptkategorie bleiben unzulässig.
- Die bestehende Beschränkung auf genau eine Unterkategorie-Ebene bleibt
  bestehen.
- Beim Umbenennen darf eine Kategorie nur mit einer anderen Kategorie im
  selben Elternkontext kollidieren; gleiche Namen unter anderen Eltern sind
  erlaubt.

### Anzeige

Die sichtbare Bezeichnung einer Unterkategorie ist ihr vollständiger Pfad:

```text
Haus → Gebühren
Bank → Gebühren
```

Hauptkategorien werden weiterhin nur mit ihrem eigenen Namen angezeigt.
Diese Darstellung wird überall einheitlich verwendet, insbesondere in:

- Stammdaten und Kategorienübersicht,
- Zuordnungen und Regeln,
- Buchungsfiltern,
- Budgetpositionen und Auswahlfeldern.

Das technische Präfix `Unterkategorie ·` wird nicht mehr ausgegeben.

### Statistik

Im Budget-Ist-Vergleich gibt es für die Dimension `Kategorien` zwei
Gruppierungsarten:

1. `Struktur` (Standard):
   - `Haus → Gebühren` und `Bank → Gebühren` werden getrennt dargestellt.
   - Das erhält das bisherige Verhalten und die bisherige Bedeutung der
     Kategorie-ID.
2. `Name zusammenfassen`:
   - beide Einträge werden unter `Gebühren` zusammengefasst.
   - Plan- und Ist-Beträge beider Elternkontexte fließen in dieselbe Gruppe
     ein.
   - Die Detailansicht weist weiterhin die zugrunde liegenden vollständigen
     Pfade aus, damit die Summe nachvollziehbar bleibt.

Für `Bereiche` und `Projekte` gibt es keine zusätzliche Gruppierungsart.

## Datenmodell und Migration

### Bestehende IDs

IDs bestehender Kategorien dürfen sich nicht ändern. Bereits gespeicherte
Buchungen, Planpositionen, Regeln und Zuordnungen bleiben dadurch gültig.

Die bisherige ID-Erzeugung nach Kategoriename wird für neue, nicht kollidierende
Kategorien weiterverwendet. Wenn ein neuer Kategoriename bereits als ID
existiert, wird für die zusätzliche Kategorie eine deterministische,
elternkontextbezogene ID erzeugt. Dafür wird ein zentraler Helper verwendet,
der mindestens `kind`, `label` und `parent_id` berücksichtigt. Der Helper darf
die ID einer bereits vorhandenen Kategorie nicht nachträglich verändern.

### Normalisierung vorhandener Daten

Die Katalog-Normalisierung wird von globaler Namenseindeutigkeit auf
Elternkontext-Eindeutigkeit umgestellt. Einträge mit gleichem Namen unter
verschiedenen `parent_id`-Werten bleiben erhalten.

Falls Altbestände trotz der bisherigen Prüfung mehrere gleiche Namen im selben
Elternkontext enthalten, werden sie deterministisch dedupliziert. Der zuerst
auftretende Eintrag behält seine ID; Verweise auf verworfene Duplikate werden
nicht stillschweigend umgeschrieben. Dieser Ausnahmefall wird als
Normalisierungsfehler protokolliert beziehungsweise durch die bestehende
Reparatur-/Validierungslogik sichtbar gemacht. Die reguläre Migration erzeugt
keine neuen Kategorien und verändert keine Buchungsdaten.

## API- und Backend-Änderungen

### Katalog-Endpunkte

- Create und Update prüfen Duplikate anhand von
  `(parent_id, label.casefold())`.
- Die Elternprüfung und die Beschränkung auf eine Ebene bleiben unverändert.
- Die Anzeige-Hilfsfunktion für Kategorien liefert den vollständigen Pfad,
  damit HTTP-Antworten und Frontend nicht eigene Hierarchie-Logik duplizieren.

### Statistik-Endpunkte

Die Statistik-Abfragen erhalten einen optionalen Parameter:

```text
category_grouping=structure|name
```

- Standardwert ist `structure`.
- Der Parameter wird nur für die Kategorien-Dimension ausgewertet.
- Unbekannte Werte werden als ungültige Anfrage abgelehnt; es gibt keinen
  stillen Fallback auf eine andere Auswertung.
- Der Übersichts-Endpunkt und der Breakdown-Endpunkt verwenden dieselbe
  Gruppierungsart.

Die interne Statistik-API erhält dafür einen expliziten Gruppierungsparameter.
Die Gruppenschlüssel müssen stabil und von der Anzeige getrennt sein:

- Strukturmodus: Kategorie-ID.
- Namensmodus: normalisierter Kategoriename, zum Beispiel
  `category-name:gebühren`.

Die Antwort verwendet im Namensmodus `Gebühren` als Gruppenbezeichnung. Die
Breakdown-Daten enthalten zusätzlich die vollständigen Quellpfade oder eine
gleichwertige Liste von Quellkategorien, damit `Haus → Gebühren` und
`Bank → Gebühren` in den Details erkennbar bleiben.

Bereits bestehende Antwortfelder werden soweit möglich beibehalten; neue
Metadaten werden additiv ergänzt. Bestehende Clients ohne den Parameter
erhalten weiterhin Strukturmodus.

## Frontend-Verhalten

### Kategoriepfade

Eine gemeinsame Formatierungsfunktion erzeugt den sichtbaren Pfad. Sie wird
für Optionen, Übersichten, Regeln, Filter und Statistik-Details verwendet.
Dadurch kann keine Ansicht wieder versehentlich das Präfix
`Unterkategorie ·` einführen.

Die Pfeildarstellung nutzt ein einzelnes typografisches Trennzeichen mit
ausreichendem Abstand (`Haus → Gebühren`). Lange Pfade werden in engen
Auswahlfeldern sauber gekürzt, ohne den eigentlichen Wert zu verändern; der
vollständige Pfad bleibt über den zugänglichen Namen beziehungsweise das
native Auswahlverhalten verfügbar.

### Gruppierungsumschalter

Im Budget-Ist-Vergleich wird bei ausgewählter Dimension `Kategorien` ein
zugänglicher Umschalter für `Struktur` und `Name zusammenfassen` angezeigt.

- `Struktur` ist vorausgewählt.
- Beim Wechsel wird die Statistik mit `category_grouping` neu geladen.
- Ein geöffneter Breakdown wird beim Wechsel geschlossen oder eindeutig neu
  geladen, damit keine Detaildaten aus der vorherigen Gruppierung sichtbar
  bleiben.
- Beim Wechsel auf `Bereiche` oder `Projekte` wird der Umschalter ausgeblendet
  und die Gruppierung zurückgesetzt.
- Die Auswahl ist sowohl per Tastatur als auch mit Screenreader verständlich.

Bei einer zusammengefassten Gruppe zeigt die Detailansicht die Gruppe als
`Gebühren` und darunter die beteiligten vollständigen Pfade.

## Tests und Verifikation

### Python

- Katalog-Normalisierung erhält gleiche Namen unter unterschiedlichen Eltern.
- Gleicher Name im selben Elternkontext wird weiterhin abgelehnt.
- Bestehende Kategorie-IDs bleiben bei der Normalisierung unverändert.
- Neue kollidierende Unterkategorien erhalten stabile, unterschiedliche IDs.
- Create und Update prüfen die Eindeutigkeit im richtigen Elternkontext.
- Strukturmodus trennt `Haus → Gebühren` und `Bank → Gebühren`.
- Namensmodus kombiniert deren Plan- und Ist-Beträge.
- Breakdown im Namensmodus liefert beide Quellpfade.
- Ungültige `category_grouping`-Werte werden per HTTP abgelehnt.
- Bereiche und Projekte bleiben vom neuen Gruppierungsmodus unverändert.

### Frontend

- Kategorien werden mit vollständigem Pfad und ohne `Unterkategorie ·`
  gerendert.
- Der Umschalter erscheint nur für die Kategorie-Dimension.
- Beide Gruppierungswerte werden beim Laden der Statistik korrekt übertragen.
- Ein Namens-Breakdown zeigt weiterhin die vollständigen Quellpfade.

### Ausführung

Nach der Implementierung werden mindestens die fokussierten Python- und
Node-Tests, die Python-Syntaxprüfung und der bestehende Frontend-Detektor
ausgeführt. Vor der Übergabe werden außerdem Diff und Arbeitsbaum geprüft.

## Nicht Bestandteil

- Mehr als eine Unterkategorie-Ebene.
- Zusammenfassen von Bereichen oder Projekten nach Namen.
- Automatisches Umhängen bestehender Kategorien.
- Eine rückwirkende Änderung der IDs bestehender Kategorien.
- Eine neue frei konfigurierbare Statistikdimension außerhalb der beiden
  beschriebenen Gruppierungsarten.
