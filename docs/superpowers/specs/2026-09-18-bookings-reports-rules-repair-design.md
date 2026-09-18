# Buchungshistorie, Auswertungen, Regeln und Personenreparatur

## Ziel

Die bisher getrennten Prüflisten und Monatskennzahlen werden zu einem
nachvollziehbaren Buchungs- und Auswertungsworkflow erweitert. Nutzer sollen
historische Buchungen finden, gespeicherte Aufteilungen direkt korrigieren,
Regeln präziser formulieren, Monats-/Jahres-/Cashflow-Sichten nutzen und
verwaiste Home-Assistant-Personenziele reparieren können.

## Umfang

Enthalten sind:

1. eine authentifizierte Buchungsabfrage mit Suche, Filtern und Importhistorie,
2. direkte Bearbeitung gespeicherter Buchungsaufteilungen,
3. Regelbedingungen für Richtung, Gegenparteikonto und Betragsspanne,
4. Monats-, Jahres- und Cashflow-Berechnungen einschließlich Tier-/Futterdaten,
5. ergänzende Finanzsensoren,
6. Erkennung und Reparatur nicht mehr vorhandener `person.*`-Ziele.

Nicht enthalten sind automatische Dateiübernahme, Open Banking, mehrere
Währungen, Szenarien oder Steuerberichte.

## Datenverträge

### Regeln

Die bestehenden Regel-Felder bleiben erhalten. Ergänzt werden optionale Felder:

- `direction`: `income`, `expense` oder `null`; die Richtung wird aus dem
  Vorzeichen der Buchung abgeleitet (`income` bei positivem Betrag,
  `expense` bei negativem Betrag).
- `counterparty_account`: normalisierte Kontoreferenz oder `null`. Vollständige
  Kontoreferenzen werden nur intern gespeichert und in API/Panel maskiert.
- `amount_min` und `amount_max`: positive Eurobeträge oder `null`. Beide Grenzen
  sind inklusive; nur `amount_min` bedeutet Untergrenze, nur `amount_max`
  Obergrenze. Verglichen wird mit dem Absolutbetrag.

Mindestens eine Bedingung aus Konto, Zahlungsempfänger, Gegenparteikonto,
Verwendungszweck, Richtung oder Betragsspanne ist erforderlich. Die bestehende
Prioritäts- und Konfliktlogik bleibt unverändert. Eine ungültige Regel mit
höchster Priorität blockiert weiterhin den Fallback auf niedrigere Prioritäten.

### Buchungen und Aufteilungen

Die Buchungsdaten bleiben rückwärtskompatibel. Neue Regel-Felder werden bei
alten Regeln als `null` behandelt. Aufteilungen erhalten optional
`target_label`, einen beim Speichern ermittelten Namen-Snapshot des damaligen
Ziels. Bestehende Beträge, Tier-Snapshots und Katalog-Snapshots werden nicht
verändert.

### Buchungsabfrage

`GET /api/finanzplaner/bookings` liefert alle Buchungen und akzeptiert optionale
Query-Parameter:

- `q`: Suche in Gegenpartei, Absender, Verwendungszweck und Kontobezeichnung,
- `from` / `to`: inklusive Buchungsdatum im Format `JJJJ-MM-TT`,
- `account_id`, `target`, `category_id`, `area_id`, `project_id`, `status`,
- `limit` und `offset` zur Begrenzung der Antwort.

Die Antwort enthält maskierte Projektionen, Gesamtanzahl und angewendete
Filter. Bestehende spezialisierte Endpunkte für Prüfliste und Übernahmesicht
bleiben unverändert.

`GET /api/finanzplaner/imports` liefert die gespeicherten Importläufe mit
Dateiname, Format, Zeitpunkt, akzeptierten Buchungen, Duplikatanzahl und
Dateiübersichten. Es werden keine Upload-Bytes ausgeliefert.

## Berechnungs-API

Die bestehende Monatsübersicht bleibt kompatibel. Sie wird intern durch
folgende reine Core-Funktionen ergänzt:

- `overview_period(data, start, end)`: aggregiert Plan, Prognose, Ist,
  Abweichung, ungeklärte Beträge und Futterereignisse für einen Zeitraum.
- `cashflow_series(data, start, end)`: liefert chronologisch gruppierte
  Monatswerte für Einnahmen, Ausgaben, Rücklagen, Plan, Prognose und Ist.
- `overview_report(data, start, end)`: liefert Haushaltswerte sowie
  Dimensionen für Kategorie, Bereich, Projekt, Person, Konto und Tier.

`GET /api/finanzplaner/report` akzeptiert `from`, `to` und optional `view` mit
`month`, `year` oder `cashflow`. Der Jahresbericht verwendet den gesamten
Kalenderzeitraum; der Cashflow liefert eine Monatsreihe. Ungeklärte Buchungen
werden separat ausgewiesen und nicht als bestätigtes Ist gezählt.

## Personenreparatur

Die API erkennt bei jeder Buchungsprojektion und im Bericht Ziele, die nicht
mehr in den aktuellen `person.*`-Entitäten vorhanden sind. Solche Aufteilungen
erhalten `target_status="missing"` und behalten Zielreferenz, Betrag sowie
Snapshots.

`POST /api/finanzplaner/bookings/{booking_id}/repair-targets` akzeptiert eine
Liste von `{"from": "person.alt", "to": "person.neu"}`. Der Server prüft alle
neuen Ziele gegen aktuelle Personen, ersetzt nur die Zielreferenz, lässt die
Centbeträge und fachlichen Zuordnungen unverändert und speichert die Buchung.
`household` darf als Ziel ebenfalls verwendet werden. Nicht auflösbare alte
Ziele werden nicht automatisch gelöscht.

## Panel-Workflow

Die Finanzoberfläche bleibt eine Operate-Oberfläche mit dem bestehenden
Marineblau-/Papier-/Cyan-/Amber-/Koralle-System.

- Die Buchungsansicht erhält einen sichtbaren Filterstreifen mit Suche,
  Zeitraum, Status, Konto und Katalogfiltern. Die gewählte Filterung bleibt
  beim Nachladen erhalten und zeigt einen klaren Leerzustand.
- Die Importhistorie wird als eigene, kompakte Tabelle unterhalb der Filter
  erreichbar, ohne Upload-Bytes in die Oberfläche zu laden.
- In der Übernahmesicht wird eine Aufteilung über einen Editierdialog geöffnet.
  Der Dialog verwendet dieselbe centgenaue Formularvalidierung wie die
  Prüfliste und bietet Speichern, Abbrechen, Fehler-, Lade- und Disabled-Zustand.
- Die Regelmaske erhält Richtung, Gegenparteikonto sowie Mindest-/Höchstbetrag.
  Kontoreferenzen werden nur maskiert dargestellt.
- Die Monatsübersicht erhält einen Zeitraum-/Berichtsumschalter und zeigt
  Jahres- und Cashflow-Werte in semantischen Tabellen mit horizontalem
  Reflow auf schmalen Ansichten.
- Fehlende Personenziele werden direkt an der betroffenen Aufteilungszeile
  gekennzeichnet. Die Reparatur öffnet einen fokussierten Dialog mit einer
  Ersatzauswahl; der vorhandene Betrag bleibt sichtbar.

Alle neuen UI-Zustände benötigen sichtbaren Tastaturfokus, echte Labels,
ausreichende Touch-Ziele sowie Lade-, Fehler-, Leer- und Deaktiviert-Zustände.

## Sensoren

Zusätzlich zu den bestehenden Sensoren werden bereitgestellt:

- geplante Einnahmen,
- geplante Ausgaben,
- geplante Rücklagen,
- Prognose,
- offener Betrag,
- Haushalts-Saldo,
- nächste größere geplante Zahlung.

Die Werte beziehen sich auf den aktuellen Koordinator-Monat. Der bestehende
Futter-Sensor und Binary-Sensor bleiben unverändert.

## Sicherheit und Migration

- Storage-Version 2 bleibt erhalten; neue optionale Felder werden beim Laden
  normalisiert.
- Jede neue View verlangt Home-Assistant-Authentifizierung.
- `_response_payload()` und die vorhandene Maskierungslogik werden für jede
  API-Antwort verwendet.
- Importfehler, ungültige Filter und Reparaturfehler dürfen den Store nicht
  verändern.
- Keine vollständige IBAN darf in Panel, API, Logs, Tests oder Dokumentation
  erscheinen.

## Abnahmekriterien

- Historische und übernommene Buchungen sind filterbar und paginiert abrufbar.
- Importläufe und Duplikatentscheidungen sind ohne Quelldatei-Bytes sichtbar.
- Eine bestätigte Aufteilung kann direkt geändert werden; Kontodaten bleiben
  unverändert.
- Regeln matchen alle sechs vorgesehenen Bedingungstypen deterministisch.
- Monats-, Jahres- und Cashflow-Auswertungen stimmen bei positiven,
  negativen, ungeklärten und zukünftigen Werten.
- Fehlende Personen werden markiert und durch eine gültige Person oder den
  Haushalt ersetzbar, ohne Centbeträge zu verlieren.
- API, Core, Panel und Storage sind durch Regressionstests abgedeckt.
