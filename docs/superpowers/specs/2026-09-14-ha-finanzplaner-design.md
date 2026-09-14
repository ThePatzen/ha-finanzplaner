# HA Finanzplaner: Designspezifikation

**Stand:** 2026-09-14  
**Status:** Entwurf zur Freigabe  
**Repository:** `ThePatzen/ha-finanzplaner`

## Ziel

Der Finanzplaner ersetzt die aktuelle Excel-Datei durch eine lokal in Home Assistant laufende Finanzplanung. Die Anwendung verwaltet geplante Einnahmen, Ausgaben, Rücklagen und Sonderzahlungen. Sie importiert echte Bankbuchungen aus MT940 und CAMT.053 und vergleicht Planung und Ist-Daten.

Die Anwendung unterstützt mehrere Personen, gemeinsame Konten, Buchungsaufteilungen, frei konfigurierbare Bereiche wie „Hunde“ und Projekte wie „PV-Anlage“ oder „EMX“.

## Festgelegter Umfang

Die erste Version unterstützt:

- EUR als erste und einzige Währung
- einen gemeinsamen Haushaltsplan
- mehrere Bankkonten
- mehrere Kontoinhaber pro Konto
- Home-Assistant-Personen als Personenreferenzen
- geplante wiederkehrende und einmalige Finanzposten
- echte Buchungen aus manuellen Dateiimporten
- MT940 und CAMT.053
- Buchungsaufteilungen auf Personen, Bereiche, Kategorien und Projekte
- automatische Zuordnungsregeln mit manueller Prüfung
- Excel-Import der bereitgestellten Vorlage
- Kennzahlen als Home-Assistant-Sensoren
- Installation und Updates über HACS

Die Anwendung baut zunächst keine direkte Open-Banking-Verbindung auf und überwacht kein Verzeichnis automatisch. Ein Nutzer lädt Bankdateien bewusst über die Finanzplaner-Oberfläche hoch.

## Fachliches Modell

### Personen

Die Integration liest die vorhandenen `person.*`-Entitäten aus Home Assistant ein. Sie führt keine eigene Kopie der Personenstammdaten. Das Modell speichert die Entitätsreferenz, die erkannte eindeutige Referenz sofern vorhanden und den damaligen Anzeigenamen für historische Ansichten.

Die App bietet zusätzlich die virtuelle Zuordnung „Haushalt“ an. Diese Zuordnung gehört nicht zu Home Assistant und deckt gemeinsame Ausgaben ab.

Wenn eine Person umbenannt oder entfernt wurde, markiert die App betroffene Datensätze als nicht auflösbar und bietet eine Reparatur an. Historische Buchungen verlieren dabei ihre gespeicherten Zuordnungsbeträge nicht.

### Bankkonten

Ein Bankkonto enthält:

- Anzeigename
- maskierte IBAN
- Währung
- eine Liste von Home-Assistant-Personen als Kontoinhaber
- optional die Zuordnung „Haushalt“

Die Kontoinhaber beschreiben die Zahlungsquelle. Sie bestimmen nicht automatisch, wem eine Buchung fachlich gehört. Ein Gemeinschaftskonto kann daher Buchungen für Person A, Person B, den Haushalt oder mehrere Personen enthalten.

### Bereiche, Kategorien und Projekte

Die App trennt drei Auswertungsdimensionen:

- **Bereich/Zweck:** zum Beispiel Hunde, Wohnen, Mobilität, Urlaub
- **Kategorie:** zum Beispiel Futter, Steuer, Tierarzt, Gehalt, PV-Erlöse
- **Projekt:** zum Beispiel PV-Anlage, EMX, Stimmquadrat

Bereiche und Kategorien kann der Nutzer selbst verwalten. Die Zuordnung „Hunde“ bleibt zunächst ein gemeinsamer Bereich. Einzelne Tiere gehören nicht zum ersten Umfang.

Die Excel-Kategorie „Hunde“ wird beim Import als Bereich übernommen. Bezeichnungen wie „Hundefutter“ und „Hundesteuer“ bleiben als Buchungs- oder Planpostenbezeichnung erhalten und können als Kategorien verfeinert werden.

### Planposten

Ein Planposten beschreibt eine erwartete Zahlung oder Einnahme. Er enthält:

- Richtung: Einnahme, Ausgabe oder Rücklage
- Bezeichnung
- Bereich, Kategorie und optionales Projekt
- eine oder mehrere Personenaufteilungen
- Betrag je Zahlung
- Zahlungsrhythmus oder konkrete Termine
- Gültigkeitszeitraum
- Fälligkeitstag oder Fälligkeitsmonat
- Notizen
- Datum der letzten Prüfung
- Aktiv-Status

Unterstützte Rhythmen sind monatlich, alle zwei Monate, quartalsweise, halbjährlich, jährlich, einmalig und variabel. Die App berechnet daraus getrennt:

1. einen normalisierten Monatswert für Budget und Vergleich
2. konkrete geplante Zahlungstermine für den Cashflow

Damit bleiben die Excel-Auswertungen erhalten, ohne jährliche Zahlungen fälschlich als monatliche Kontobewegungen darzustellen.

Gehalt wird als `Einnahmen / Erwerbseinkommen / Gehalt` geführt. PV-Erlöse werden als `Einnahmen / Energieerlöse / PV-Erlöse` und mit dem Projekt `PV-Anlage` geführt. PV-Einnahmen können als variable Monatswerte oder als erwartete Jahreszahlung geplant werden. Wartung, Versicherung und Finanzierung der Anlage bleiben separate Ausgabenposten im selben Projekt.

Urlaubsgeld wird als saisonale oder einmalige Einnahme beziehungsweise zweckgebundene Rücklage abgebildet. Die Ansichten können es separat ausweisen.

### Bankbuchungen

Eine Buchung speichert mindestens:

- Konto
- Buchungsdatum
- Valutadatum, sofern vorhanden
- Betrag und Richtung
- Währung
- Gegenpartei und Gegenpartei-IBAN, sofern vorhanden
- Verwendungszweck
- Bankreferenzen und Buchungscode, sofern vorhanden
- Importlauf
- Rohwerte der relevanten Parserfelder
- Bearbeitungsstatus

Eine Buchung kann beliebig viele Aufteilungen besitzen. Jede Aufteilung enthält:

- Betrag oder Prozentsatz
- Person oder „Haushalt“
- optionalen Bereich
- optional Kategorie
- optionales Projekt

Die Summe der Aufteilungen muss dem absoluten Buchungsbetrag entsprechen. Eine unvollständige Buchung bleibt in der Prüfliste und zählt nicht als vollständig zugeordnet.

Beispiele:

```text
85,00 EUR Hundefutter
└── Haushalt | Hunde | Futter | 85,00 EUR

200,00 EUR Supermarkt vom Gemeinschaftskonto
├── Person A | Haushalt | 100,00 EUR
└── Person B | Haushalt | 100,00 EUR

100,00 EUR Tierarzt für Person A
└── Person A | Hunde | Tierarzt | 100,00 EUR
```

## Bankimport

Der Import läuft in sechs Schritten:

1. Der Nutzer lädt eine MT940- oder CAMT.053-Datei hoch.
2. Die App erkennt das Format und validiert die Datei.
3. Die App zeigt alle erkannten Konten und Buchungen als Vorschau.
4. Die App berechnet Duplikatfingerprints und markiert bereits bekannte Buchungen.
5. Der Nutzer bestätigt den Import.
6. Die App wendet Zuordnungsregeln an und legt unklare Buchungen in die Prüfliste.

Die Parser werden formatgetrennt implementiert. Bankvarianten dürfen die Parser nicht in der UI oder in der Berechnungslogik vermischen.

Die Duplikaterkennung verwendet bevorzugt Bankreferenzen. Falls diese fehlen, kombiniert sie Konto, Datum, Betrag, Gegenpartei, Verwendungszweck und weitere verfügbare Felder. Der Nutzer kann einen falsch erkannten Treffer manuell freigeben.

Ein Importlauf speichert Dateiformat, Zeitpunkt, Dateiname, Hash und Anzahl der übernommenen, übersprungenen und fehlerhaften Buchungen. Die Anwendung speichert die Originaldatei standardmäßig nicht dauerhaft. Relevante normalisierte Parserdaten bleiben erhalten.

### Zuordnungsregeln

Regeln können auf Konto, Gegenpartei, Gegenpartei-IBAN, Verwendungszweck, Betrag und Richtung prüfen. Eine Regel kann Kategorie, Bereich, Projekt und Personenaufteilungen vorschlagen.

Beispiele:

- Verwendungszweck enthält „Hundefutter“ → Bereich Hunde, Kategorie Futter
- Verwendungszweck enthält „Tierarzt“ → Bereich Hunde, Kategorie Tierarzt
- Gegenpartei entspricht einem Arbeitgeber → Erwerbseinkommen, Gehalt, zuständige Person
- Gegenpartei entspricht einem Energieversorger → PV-Anlage, PV-Erlöse

Regeln haben eine Priorität. Automatisch angewandte Regeln bleiben sichtbar und können rückgängig gemacht werden.

## Excel-Migration

Der Excel-Importer unterstützt zunächst die bereitgestellte Vorlage. Er liest die Eingabespalten der Blätter `Einnahmen`, `Ausgaben`, `Sparen  und Rücklagen`, `Urlaubsgelder` und `EMX Calc`.

Die Zahlungsrhythmus-Spalten werden in strukturierte Planposten übersetzt. Berechnete Excel-Spalten werden nicht als neue Finanzquelle behandelt. Hardcodierte Formeln, Mehrwertsteuerfaktoren und Multiplikatoren werden als Prüfhinweise markiert, damit der Nutzer die fachliche Bedeutung bestätigen kann.

Der Import erhält:

- ursprüngliche Bezeichnung
- ursprüngliche Gruppierung
- Beträge je Zahlungsrhythmus
- Prüfdatum, sofern vorhanden
- historische Vergleichswerte, sofern sie eindeutig zugeordnet werden können

Die Werte aus `EMX Calc` werden in Projektposten und Projektkosten überführt. Nicht eindeutig rekonstruierbare Excel-Formeln erscheinen in einer Migrationsprüfliste.

Die öffentliche Repository-Version darf keine persönliche Excel-Datei mit echten Finanzdaten enthalten. Die Vorlage bleibt lokal oder wird durch eine anonymisierte Testdatei ersetzt.

## Home-Assistant-Integration

Die Integration wird über HACS installiert und anschließend über einen Config Flow eingerichtet. YAML-Konfiguration ist nicht erforderlich.

Geplante Repository-Struktur:

```text
custom_components/finanzplaner/
├── __init__.py
├── manifest.json
├── config_flow.py
├── const.py
├── coordinator.py
├── storage.py
├── models.py
├── calculations.py
├── importers/
│   ├── mt940.py
│   ├── camt053.py
│   └── excel_template.py
├── frontend/
├── strings.json
└── translations/
    └── de.json
```

Die Finanzdaten werden mit versioniertem persistentem Integrationsspeicher und expliziten Migrationen verwaltet. Die Integration bearbeitet keine Dateien in HA-internen `.storage`-Verzeichnissen direkt.

Die Finanzansicht benötigt eine kleine eigene UI für Planung, Buchungen, Importe, Regeln und Prüfliste. Home-Assistant-Authentifizierung schützt die Ansicht und die Aktionen.

Die Integration stellt ausgewählte Kennzahlen bereit:

- monatliche Einnahmen geplant
- monatliche Ausgaben geplant
- monatliche Rücklagen geplant
- monatlicher Restbetrag geplant
- tatsächliche Einnahmen und Ausgaben im gewählten Monat
- PV-Erlöse im gewählten Jahr
- Anzahl ungeklärter Buchungen
- nächste größere geplante Zahlung

Die Detailbuchungen bleiben in der Finanzansicht und werden nicht einzeln als HA-Entities angelegt.

## Sicherheit und Datenschutz

- Bankdateien werden ausschließlich lokal in Home Assistant verarbeitet.
- Die Integration benötigt keine Bankzugangsdaten.
- IBANs erscheinen in der Oberfläche standardmäßig maskiert.
- Vollständige Verwendungszwecke und Kontodaten werden nicht in normalen Logs ausgegeben.
- Upload-Dateien werden nach der Verarbeitung nicht dauerhaft gespeichert.
- Importläufe und Änderungen bleiben für die Nachvollziehbarkeit erhalten.
- Die öffentliche GitHub-Version enthält keine echten Konten, Buchungen oder persönlichen Beträge.

## MVP und spätere Ausbaustufen

### MVP

1. HACS- und Integrationsgrundstruktur
2. Config Flow und persistenter Speicher
3. Home-Assistant-Personen und Haushaltszuordnung
4. Konten und Planposten
5. Berechnungen für Monat, Jahr und Cashflow
6. Buchungsmodell mit Aufteilungen
7. MT940- und CAMT.053-Import mit Vorschau und Duplikaterkennung
8. Prüfliste und einfache Zuordnungsregeln
9. Excel-Migration
10. Finanzansicht und zentrale HA-Sensoren

### Danach

- Budget-Ist-Vergleiche mit erweiterten Diagrammen
- Regelmäßige automatische Dateiübernahme
- mehrere Szenarien und Jahresversionen
- wiederkehrende automatische Reports und Benachrichtigungen
- Unterstützung weiterer CAMT-Varianten
- direkte Open-Banking- oder Bank-API-Anbindung
- mehrere Währungen
- detailliertere Steuer- und PV-Auswertungen

## Qualitätssicherung

Die Tests prüfen mindestens:

- Normalisierung der Zahlungsrhythmen
- konkrete Fälligkeitstermine
- Aufteilungsbeträge und Rundungen
- gemeinsame Konten und mehrere Personen
- Person-Referenzen mit fehlenden Entitäten
- MT940-Parser mit anonymisierten Bankdateien
- CAMT.053-Parser mit anonymisierten Bankdateien
- Duplikaterkennung
- Regelprioritäten
- Excel-Migration
- Migration alter Speicherversionen

Vor einer Veröffentlichung laufen Linting, Python-Tests, Home-Assistant-Integrationsvalidierung und HACS-Strukturprüfung. GitHub-Releases verwenden eine nachvollziehbare Versionsnummerierung.

## Bewusste Designentscheidungen

- Planwerte und echte Buchungen bleiben getrennt.
- Kontoinhaber und fachliche Buchungszuordnung bleiben getrennt.
- Eine Buchung kann mehrere Personen, Bereiche, Kategorien und Projekte enthalten.
- „Hunde“ bleibt ein gemeinsamer Bereich.
- „PV-Anlage“ wird als eigenes Projekt geführt.
- Die erste Bankanbindung arbeitet mit manuellen Dateiimporten.
- Die Finanzdaten gehören der Integration, nicht einzelnen HA-Helfern.
- Die öffentliche GitHub-Version enthält keine privaten Beispieldaten.
