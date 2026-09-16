# Buchungsregeln und Zuordnungsvorschläge

**Stand:** 2026-09-16
**Status:** Entwurf zur Nutzerprüfung
**Repository:** `ThePatzen/ha-finanzplaner`

## Ziel

Der Finanzplaner soll wiederkehrende Buchungen anhand transparenter Regeln
erkennen und eine passende Aufteilung vorschlagen. Die Anwendung speichert
keinen Vorschlag ohne ausdrückliche Bestätigung.

Eine bestätigte Buchung kann die Ausgangsbasis für eine neue Regel bilden. So
reduziert der Finanzplaner wiederholte manuelle Arbeit, ohne die fachliche
Kontrolle über Finanzdaten abzugeben.

## Ausgangslage

- Der persistente Store enthält bereits den Bereich `rules`, aber die
  Anwendung verwaltet und verwendet ihn noch nicht.
- Importierte Buchungen erhalten zunächst den Status `unresolved`.
- `BookingAllocationsView` validiert und speichert bereits centgenaue
  Aufteilungen.
- Konten, Personen, Tiere sowie Kategorien, Bereiche und Projekte besitzen
  stabile Referenzen und werden vor dem Speichern serverseitig geprüft.
- Das Frontend verwendet eine native Home-Assistant-Oberfläche in
  `custom_components/finanzplaner/frontend/panel.js`.

## Umfang

Die erste Version umfasst:

- Regeln mit Aktivstatus und Priorität
- Konto- und Zahlungsempfängerprüfung
- optionalen Filter auf einen Verwendungszweck
- eine oder mehrere prozentuale Aufteilungsvorlagen je Regel
- sichtbare Vorschläge in `Buchungen prüfen`
- Konflikterkennung bei gleich priorisierten Regeln
- ausdrückliche Bestätigung vor dem Speichern einer Aufteilung
- Regelverwaltung mit Übersicht, Anlegen, Bearbeiten und reversibler
  Deaktivierung
- Aktion zum Erstellen einer Regel aus einer bestätigten Buchung

## Nicht im Umfang

- automatische Speicherung oder automatische Bestätigung von Vorschlägen
- automatisches Lernen aus jeder bestätigten Buchung
- direkte Bank- oder Open-Banking-Anbindung
- automatische Dateiüberwachung
- Matching nach Betrag, Richtung oder Gegenpartei-IBAN
- eigene Personen- oder Kontoinhaberdaten außerhalb von Home Assistant
- Änderung bereits bestätigter Buchungsaufteilungen durch Regeländerungen

## Fachliches Modell

Eine Regel speichert Bedingungen und eine Aufteilungsvorlage. Alle IDs bleiben
stabil; lesbare Namen dienen nur als aktuelle Anzeige beziehungsweise als
Snapshot, wenn das bestehende Buchungsmodell dies vorsieht.

```text
Rule {
  id: string
  label: string
  active: boolean
  priority: integer
  account_id: string | null
  counterparty: string
  purpose_contains: string | null
  allocations: list[RuleAllocation]
  created_at: string
  updated_at: string
}

RuleAllocation {
  target: person entity_id | household
  share_percent: decimal(5, 2)
  area_id: string | null
  category_id: string | null
  project_id: string | null
  pet_id: string | null
}
```

Regeln erfüllen beim Speichern diese Bedingungen:

- `label` enthält mindestens ein sichtbares Zeichen und höchstens 120 Zeichen.
- `priority` ist eine ganze Zahl von 0 bis 1000; höhere Werte gewinnen.
- `counterparty` enthält mindestens ein sichtbares Zeichen und höchstens 160
  Zeichen.
- `purpose_contains` bleibt leer oder enthält höchstens 160 Zeichen.
- `allocations` enthält mindestens eine Zeile.
- Jede `share_percent` liegt zwischen 0,01 und 100,00.
- Die Summe aller `share_percent`-Werte beträgt centgenau 100,00.
- Jede Zielreferenz lautet `household` oder verweist auf eine aktuell
  vorhandene Home-Assistant-`person.*`-Entität.
- Referenzierte Kategorien, Bereiche, Projekte und Tiere existieren und sind
  aktiv.

Eine Regel mit `account_id = null` gilt für jedes Konto. Eine gesetzte
`account_id` muss auf ein vorhandenes Konto zeigen. Das Konto schränkt den
Treffer ein, ersetzt aber nicht die Zahlungsempfängerprüfung.

## Matching

Der Python-Kern stellt eine reine Matching-Funktion bereit. Sie verändert
weder den Store noch eine Buchung.

Die Normalisierung entfernt führende und nachgestellte Leerzeichen, fasst
aufeinanderfolgende Leerzeichen zusammen und vergleicht ohne
Groß-/Kleinschreibung. Die Anwendung verwendet keine unsichtbaren
Ähnlichkeitswerte und keine externe Matching-Bibliothek.

Eine Regel trifft zu, wenn:

1. sie aktiv ist;
2. `account_id` leer ist oder exakt der Buchungskonto-ID entspricht;
3. der normalisierte Zahlungsempfänger exakt übereinstimmt;
4. `purpose_contains` leer ist oder der normalisierte Filter im
   normalisierten Verwendungszweck vorkommt.

Der Trefferablauf arbeitet deterministisch:

1. Die Engine verwirft Regeln mit einem nicht passenden Konto,
   Zahlungsempfänger oder Verwendungszweck.
2. Die Engine sortiert verbleibende Regeln nach `priority` absteigend und bei
   gleicher Priorität nach stabiler Regel-ID aufsteigend.
3. Eine einzelne Regel mit der höchsten Priorität erzeugt einen Vorschlag.
4. Mehrere Regeln mit der höchsten Priorität erzeugen einen Konflikt. Die
   Anwendung zeigt die betroffenen Regeln an und erzeugt keinen Vorschlag.

Die Engine materialisiert Prozentwerte in positive Cent-Beträge anhand des
absoluten Buchungsbetrags. Den Rundungsrest gibt sie deterministisch an die
erste Aufteilungszeile in der gespeicherten Reihenfolge. Danach durchläuft die
Materialisierung denselben serverseitigen Validierungspfad wie eine manuelle
Aufteilung.

Ein Regelvorschlag enthält mindestens:

```text
Suggestion {
  rule_id: string
  rule_label: string
  reason: string
  allocations: list[BookingAllocation]
}
```

Die `reason` nennt Konto, Zahlungsempfänger und optional den verwendeten
Verwendungszweckfilter in verständlicher Form. Die vollständige IBAN bleibt
außerhalb der API-Antworten maskiert.

## Status und Persistenz

Der Store bleibt unverändert, solange niemand einen Vorschlag bestätigt.
Vorschläge entstehen als Projektion beim Abruf der Prüfliste und werden nicht
als versteckte Aufteilung in der Buchung gespeichert.

Die API liefert für jede Buchung in der Prüfliste einen abgeleiteten Status:

- `unresolved`: keine passende Regel
- `suggested`: genau eine Regel mit höchster Priorität trifft zu
- `conflict`: mehrere Regeln mit höchster Priorität treffen zu

Die gespeicherte Buchung behält bis zur Bestätigung den Status `unresolved`.
Nach einer gültigen manuellen oder vorgeschlagenen Aufteilung speichert die
Anwendung die Aufteilungen und setzt den Status auf `resolved`.

Regeländerungen wirken nur auf weiterhin ungeklärte Buchungen. Bestehende
Aufteilungen und ihre historischen Snapshots bleiben unverändert.

Wenn eine Regel auf ein archiviertes oder nicht mehr vorhandenes Ziel, einen
Katalogeintrag oder ein Tier verweist, liefert die Engine keinen speicherbaren
Vorschlag. Die Prüfliste zeigt den konkreten Validierungsgrund und hält die
Buchung ungeklärt.

## HTTP-Schnittstelle

Alle neuen und erweiterten Endpunkte verwenden die bestehende Authentifizierung
des Home-Assistant-Panels und `hass.fetchWithAuth()`.

```text
GET  /api/finanzplaner/rules
POST /api/finanzplaner/rules
POST /api/finanzplaner/rules/{rule_id}
POST /api/finanzplaner/rules/from-booking/{booking_id}
GET  /api/finanzplaner/bookings/unresolved
```

`GET /rules` liefert aktive und deaktivierte Regeln mit maskierten Kontodaten.
`POST /rules` legt eine neue aktive Regel an. `POST /rules/{rule_id}` ändert
die editierbaren Felder oder setzt `active` auf `false`; die Anwendung löscht
keine Regel physisch.

`POST /rules/from-booking/{booking_id}` akzeptiert nur eine bereits als
`resolved` gespeicherte Buchung. Der Endpunkt erzeugt eine aktive Regel mit
folgenden Vorbelegungen:

- `account_id` aus der Buchung
- `counterparty` aus der Buchung
- `purpose_contains` leer, damit der Nutzer den Filter bewusst ergänzt
- `allocations` aus den bestätigten Aufteilungen, umgerechnet in
  Prozentanteile und auf zwei Nachkommastellen gerundet

Der Endpunkt liefert einen Validierungsfehler, wenn die Buchung nicht existiert,
nicht bestätigt ist oder die Aufteilungen keine sinnvolle Regelvorlage ergeben.

`GET /bookings/unresolved` behält seine bestehende Buchungsauswahl bei und
reichert jede Antwort um `status`, `suggestion` und bei Konflikten um die
konfligierenden Regel-IDs an. Die Berechnung darf den Store nicht verändern.

Die bestehenden Aufteilungsendpunkte bleiben die einzige Schreibstelle für
Buchungsaufteilungen. Sie akzeptieren weiterhin die vom Nutzer geprüften
Aufteilungsbeträge und validieren Ziele, Kataloge, Tiere sowie centgenaue
Summen serverseitig.

Fehlerfälle liefern verständliche `400`-Antworten ohne Store-Mutation:

- unbekannte oder doppelte Regel-Felder
- ungültige Priorität, Prozentwerte oder Zielreferenzen
- fehlendes Konto oder fehlender Zahlungsempfänger
- archivierte Katalogeinträge oder Tiere
- unbekannte Regel oder Buchung
- nicht authentifizierte Anfrage

## Frontend

Die bestehende native Panel-Oberfläche erhält einen Verwaltungsbereich
`Regeln`. Die Übersichtsansicht zeigt zunächst alle Regeln als semantische
Tabelle mit Aktivstatus, Priorität, Konto, Zahlungsempfänger und
Aufteilungszusammenfassung. Anlegen und Bearbeiten öffnen ein separates
Formular erst nach einer eindeutigen Nutzeraktion.

Das Formular gruppiert Bedingungen und Aufteilungsvorlage. Jedes Feld erhält
ein echtes Label, eine verständliche Fehlermeldung und einen sichtbaren
Fokuszustand. Das Formular unterscheidet unveränderte, geänderte, speichernde,
gespeicherte, fehlerhafte und deaktivierte Zustände.

In `Buchungen prüfen` zeigt die Anwendung bei `suggested` einen klar
beschrifteten Hinweis direkt an der betroffenen Buchung:

- Name der verwendeten Regel
- verständlicher Matching-Grund
- vorgeschlagene Aufteilungszeilen und Beträge
- Aktion `Vorschlag übernehmen`

Die Aktion übernimmt die Werte nur in den vorhandenen Aufteilungseditor. Der
Nutzer kann sie ändern und muss anschließend weiterhin `Aufteilung speichern`
auslösen. Ein `conflict` zeigt die konkurrierenden Regeln und eine Aktion zum
Öffnen der Regelverwaltung; die Anwendung wählt keine Regel stillschweigend.

Nach erfolgreicher Bestätigung einer Buchung bietet die Oberfläche
`Als Regel speichern` an. Die Aktion öffnet das Regel-Formular mit den
Vorbelegungen aus der Buchung und speichert erst nach einer weiteren
Bestätigung.

Die Frontend-Arbeit folgt dem Projektmodus `Operate` von `$impeccable`. Vor
jedem Markup- oder Client-JavaScript-Edit lädt der Agent den Projektkontext,
prüft die passende `$impeccable`-Vorgabe und die relevante
`modern-web-guidance`. Danach prüft er Desktop- und schmale Darstellung,
Tastaturreihenfolge, Fokus, leere, Lade-, Fehler- und deaktivierte Zustände
in einem gebündelten Durchlauf.

## Migration und Kompatibilität

Der aktuelle Store enthält bereits `rules: []`. Die Normalisierung ergänzt bei
älteren oder beschädigten Daten eine leere Regelliste, ohne Buchungen,
Aufteilungen oder Importhistorien zu verändern.

Die Implementierung erhöht die Store-Hauptversion nicht. Bestehende Regeln,
falls ein lokaler Store sie bereits enthält, bleiben erhalten und durchlaufen
vor jeder Verwendung die neue Validierung.

Die Änderung erhöht nicht automatisch die Integrationsversion. Eine spätere
Versionsfreigabe aktualisiert Manifest, README, CHANGELOG und Git-Tag nur nach
ausdrücklicher Freigabe.

## Datenschutz und Sicherheit

- Regeln werden ausschließlich im lokalen Home-Assistant-Store gespeichert.
- API-Antworten maskieren IBANs und Kontoangaben wie die bestehenden Endpunkte.
- Verwendungszwecke und Zahlungsempfänger erscheinen nur in der
  authentifizierten Panel-Antwort.
- Der Server validiert jede aus dem Browser kommende Aufteilung erneut.
- Regelvorschläge dürfen keine Buchung ohne Nutzeraktion verändern.
- Ein Fehler während Matching, Materialisierung oder Bestätigung verwirft die
  gesamte Schreiboperation.

## Qualitätssicherung und Abnahmekriterien

Die Implementierung ist fachlich abnahmefähig, wenn folgende Fälle mit Tests
abgedeckt sind:

- ein exakter Zahlungsempfänger erzeugt bei passendem Konto einen Vorschlag;
- ein abweichendes Konto verhindert den Treffer;
- ein optionaler Verwendungszweckfilter schränkt den Treffer korrekt ein;
- deaktivierte Regeln erzeugen keinen Vorschlag;
- die Regel mit der höchsten Priorität gewinnt;
- gleich priorisierte Treffer erzeugen einen Konflikt;
- Prozentwerte werden centgenau und mit deterministischem Rundungsrest in
  Aufteilungen umgerechnet;
- ungültige Ziele oder archivierte Katalogeinträge erzeugen keinen
  speicherbaren Vorschlag;
- der Abruf der Prüfliste verändert den Store nicht;
- ein Vorschlag bleibt bis zur Bestätigung `unresolved`;
- die Bestätigung speichert genau die geprüften Aufteilungen;
- eine bestätigte Buchung kann eine Regelvorlage erzeugen;
- nicht authentifizierte Regel- und Vorschlagsanfragen werden abgewiesen;
- bestehende Import-, Konto-, Aufteilungs- und Prognosetests bleiben grün.

Für den Abschluss laufen die im README dokumentierten Python- und
Frontend-Prüfungen sowie diese zusätzlichen Checks:

```bash
node --check custom_components/finanzplaner/frontend/panel.js
python3 -m compileall -q custom_components
git diff --check
```
