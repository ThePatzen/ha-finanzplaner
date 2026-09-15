# Finanzplaner: Konten und Buchungsaufteilungen

**Stand:** 2026-09-15  
**Status:** Entwurf zur Prüfung  
**Zielversion:** `v0.3.0`  
**Repository:** `ThePatzen/ha-finanzplaner`

## Ziel

Der Finanzplaner soll die Zahlungsquelle eines Imports von der fachlichen
Zuordnung einer Buchung trennen. Ein Konto kann mehreren Personen gehören,
ohne dass jede Buchung dieses Kontos automatisch diesen Personen zugerechnet
wird.

`v0.3.0` ergänzt deshalb Konten mit automatischer Erkennung sowie eine
Aufteilungsansicht mit frei änderbaren Cent-Beträgen. Die bisherige
gleichmäßige Mehrfachzuordnung bleibt der Standard. Zuordnungsregeln erzeugen
später nur bestätigungspflichtige Vorschläge und sind nicht Teil des
Speicher- und UI-Umfangs dieser Version.

## Ausgangslage in `v0.2.3`

- Bankbuchungen speichern die erkannte Kontoangabe bisher als freie Zeichenkette
  im Feld `account`.
- `accounts` und `rules` existieren im Store, werden aber noch nicht über die
  Oberfläche verwaltet.
- Die Prüfliste ordnet eine Buchung gleichmäßig auf ausgewählte Ziele auf.
- Home-Assistant-Personen werden live als `person.*`-Entitäten gelesen.
- `Hunde` ist ein gemeinsamer Bereich und keine eigene Person oder Tierliste.

## Umfang von `v0.3.0`

### Enthalten

- automatische Kontoerkennung aus CAMT.053 und MT940
- Kontenliste mit Anzeigename, maskierter IBAN beziehungsweise Kontoangabe und
  mehreren Kontoinhabern
- Kontoinhaber als Referenzen auf aktuelle Home-Assistant-`person.*`-Entitäten
- optional die gemeinsame Quelle `Haushalt` als Kontoinhaber
- Migration bereits importierter Buchungen auf das neue Kontenmodell
- Aufteilungseditor in der Prüfliste
- gleichmäßige Cent-Aufteilung als Startwert
- manuelle Betragsänderung je Aufteilungszeile
- Ziele `Person`, `Haushalt` und der Bereich `Hunde`
- Bereich, Kategorie und Projekt je Aufteilungszeile
- Prüfung, dass die Aufteilung den Buchungsbetrag centgenau abdeckt

### Nicht enthalten

- automatische Verbuchung durch Regeln
- Prozentfelder als zusätzliches Eingabemodell
- einzelne Hunde als Stammdaten
- direkte Bankanbindung oder automatische Verzeichnisüberwachung
- Löschen gespeicherter Konten und Buchungen über die erste Kontenansicht
- Änderung historischer Kontoinhaber rückwirkend an alten Aufteilungen

Prozentwerte können später aus den gespeicherten Cent-Beträgen abgeleitet
werden. Die erste Version akzeptiert als verbindliche Eingabe nur Beträge,
damit Rundungen sichtbar und kontrollierbar bleiben.

## Fachliches Modell

### Konten

Ein Konto wird im persistenten Store so erweitert:

```text
Account {
  id: string
  label: string
  iban: string | null
  account_reference: string
  currency: "EUR"
  owner_targets: list[string]
  active: boolean
  created_at: string
  updated_at: string
}
```

Regeln für die Felder:

- `id` ist eine stabile interne Kennung und wird nicht aus einem Anzeigenamen
  gebildet.
- `iban` enthält die normalisierte vollständige IBAN nur im lokalen Store.
  Die UI zeigt standardmäßig `****` und die letzten vier Stellen.
- `account_reference` enthält die normalisierte Kontoangabe aus dem Import.
  Sie wird auch dann geführt, wenn MT940 keine IBAN liefert.
- `owner_targets` enthält eindeutige `person.*`-Entity-IDs oder den Wert
  `household`.
- Ein leeres `owner_targets` bedeutet „Kontoinhaber noch nicht konfiguriert“;
  es ist kein Fehler und führt nicht zu einer automatischen Buchungszuordnung.
- `active=false` archiviert ein Konto für neue Importe, ohne historische
  Buchungen zu verändern.

Ein Konto wird anhand der normalisierten Kontoangabe wiedererkannt. Eine
IBAN wird ohne Leerzeichen und in Großschreibung verglichen. Wenn nur eine
bankeigene MT940-Kennung verfügbar ist, bleibt diese als
`account_reference` erhalten. Unterschiedliche unbekannte Kennungen werden
nicht automatisch zusammengeführt.

### Buchungen

Die bisherige Kontoangabe bleibt zur Rückwärtskompatibilität nachvollziehbar,
wird aber fachlich getrennt:

```text
Booking {
  id: string
  account_id: string | null
  account_reference: string
  ...bestehende normalisierte Buchungsfelder...
  allocations: list[Allocation]
  status: unresolved | suggested | resolved
}
```

`account_id` verweist auf ein erkanntes lokales Konto. Bei einer unbekannten
oder leeren Kontoangabe bleibt es `null`; die Buchung kann trotzdem importiert
werden und erscheint in der Prüfliste.

`account_id` beschreibt nur die Zahlungsquelle. Weder die Kontoinhaber noch
die Anzahl der Kontoinhaber werden bei der Buchungszuordnung automatisch als
Ziele verwendet.

### Aufteilungen

Jede Aufteilungszeile hat dieses Format:

```text
Allocation {
  target: person entity_id | household
  amount: positive EUR value rounded to 0.01
  area: string | null
  category: string | null
  project: string | null
}
```

`Hunde` wird über `area="Hunde"` modelliert. Eine gemeinsame Hundebuchung
hat daher typischerweise `target="household"` und `area="Hunde"`. Damit
bleibt die gewünschte gemeinsame Zuordnung erhalten, ohne künstliche
Tierpersonen anzulegen.

Beträge werden intern vor jeder Prüfung auf zwei Nachkommastellen mit
`Decimal` quantisiert. Die Summe der positiven Aufteilungsbeträge muss dem
Absolutwert der Buchung entsprechen. Die Richtung der Buchung bleibt am
Buchungsbetrag erhalten und wird nicht in den positiven Aufteilungsbeträgen
wiederholt.

## Store-Migration

Der Store erhöht seine Versionsnummer von `1` auf `2`. Die Migration ist
deterministisch und erhält alle bestehenden Daten:

1. Für jede unterschiedliche nichtleere alte Kontoangabe wird ein lokales
   Konto mit stabiler Kennung, maskierter Standardbezeichnung und leerer
   Inhaberliste angelegt.
2. Alte Buchungen übernehmen die Kontoangabe nach `account_reference` und
   erhalten die passende `account_id`.
3. Buchungen ohne Kontoangabe behalten `account_id=null`.
4. Vorhandene `allocations` bleiben unverändert; fehlende Felder werden mit
   `[]` beziehungsweise `null` ergänzt.
5. `plan_items`, `imports` und `rules` bleiben inhaltlich unverändert.

Die Migration wird ausschließlich über den bestehenden versionierten
Home-Assistant-Store ausgeführt. Direkte Änderungen an HA-internen
`.storage`-Dateien sind ausgeschlossen.

## Importablauf

Der Import erhält diese Reihenfolge:

1. Datei lokal einlesen und Format validieren.
2. Kontoangabe aus dem Parser normalisieren.
3. Bestehendes Konto über `account_reference` oder IBAN suchen.
4. Bei einem unbekannten Konto ein Konto ohne Inhaber anlegen.
5. Buchungen mit `account_id` und unverändertem `account_reference` speichern.
6. Duplikate wie bisher über den Buchungsfingerprint überspringen.
7. Neue Buchungen abhängig von ihrem Status in Übersicht und Prüfliste zeigen.

Schlägt das Parsen fehl, werden weder Konto noch Buchungen gespeichert. Wird
ein Konto erfolgreich erkannt, aber noch nicht konfiguriert, wird das im
Importstatus sichtbar gemacht. Ein bereits gespeichertes Konto wird nicht
durch spätere Importdaten umbenannt oder in seinen Inhabern verändert.

## Bedienung

### Kontenansicht

Die vorbereitete Navigation erhält eine echte Ansicht „Konten“ mit:

- Kontoanzeige und maskierter IBAN beziehungsweise Kontoangabe
- Status „Inhaber noch nicht konfiguriert“
- Auswahl mehrerer vorhandener `person.*`-Entitäten
- Auswahl `Haushalt`
- Anzeigename bearbeiten
- Konto archivieren

Die Ansicht speichert keine kopierten Personennamen als Identität. Für eine
historische Anzeige darf der damalige Name zusätzlich als nichtverbindlicher
Snapshot gespeichert werden; die Zuordnung bleibt die Entity-ID.

### Prüfliste und Aufteilung

Jede ungeklärte Buchung zeigt Konto, Betrag, Datum und Verwendungszweck. Die
Aufteilungsansicht startet mit einem Ziel und dem vollständigen Betrag. Wird
ein zweites Ziel hinzugefügt, wird der Betrag gleichmäßig neu verteilt.

Der Nutzer kann danach:

- weitere Personen oder `Haushalt` hinzufügen
- Ziele entfernen
- den Betrag jeder Zeile in Euro und Cent bearbeiten
- Bereich, Kategorie und Projekt je Zeile setzen
- `Hunde` als gemeinsamen Bereich auswählen
- eine verbleibende Differenz direkt erkennen

Die Schaltfläche „Zuordnen“ bleibt deaktiviert, solange keine Zielzeile
existiert oder die Summe nicht exakt dem Buchungsbetrag entspricht. Der
Rundungsrest einer gleichmäßigen Aufteilung geht deterministisch an die erste
Aufteilungszeile in der aktuellen Reihenfolge.

Nach erfolgreicher Bestätigung wird der Status `resolved` gesetzt. Eine
spätere Regelversion darf aus dieser bestätigten Aufteilung lediglich einen
Vorschlag ableiten.

## HTTP- und Frontend-Schnittstelle

Die vorhandenen authentifizierten Endpunkte bleiben bestehen. Ergänzt werden:

```text
GET  /api/finanzplaner/accounts
POST /api/finanzplaner/accounts/{account_id}
POST /api/finanzplaner/bookings/{booking_id}/allocations
```

Die Endpunkte akzeptieren ausschließlich Anfragen aus dem authentifizierten
Home-Assistant-Panel. Das Frontend verwendet weiterhin
`hass.fetchWithAuth()` für Übersicht, Konten, Import, Prüfliste und Speichern.
Die versionsgebundene statische Panel-URL aus `v0.2.3` bleibt erhalten, damit
der neue UI-Code nicht aus einem alten Browser- oder Proxy-Cache geladen wird.

Der Aufteilungs-Endpunkt validiert serverseitig:

- mindestens eine Zielzeile
- eindeutige, aktuell vorhandene `person.*`-Ziele oder `household`
- nur bekannte Bereiche, zunächst insbesondere `Hunde`
- positive Beträge mit höchstens zwei Nachkommastellen
- centgenaue Gleichheit zur Buchungssumme

Ungültige Anfragen verändern den Store nicht und liefern eine verständliche
Fehlermeldung. Die UI zeigt Backend-Fehler als Statusmeldung an und versucht
nicht, Klartext-Fehlerantworten als erfolgreiche JSON-Daten zu verarbeiten.

## Regeln als anschließender Ausbau

Die Regel-Engine wird nach dem Konten- und Aufteilungseditor ergänzt. Ihre
verbindlichen Leitplanken stehen bereits fest:

- Treffer prüfen Konto und Zahlungsempfänger; Verwendungszweck ist ein
  optionaler Zusatzfilter.
- Ein Treffer erzeugt eine sichtbare Vorschlagsaufteilung.
- Vorschläge werden nie ohne Nutzerbestätigung gespeichert.
- Widersprüchliche Treffer bleiben ungeklärt.
- Eine bestätigte Buchung kann als Ausgangspunkt für eine Regel dienen.

Damit muss `v0.3.0` noch keine automatische Regelanwendung implementieren,
aber die Buchungs- und Aufteilungsdaten sind dafür vollständig vorbereitet.

## Datenschutz und Sicherheit

- IBAN und Kontoangaben bleiben lokal in Home Assistant.
- Vollständige IBANs erscheinen weder in der normalen UI noch in Logs.
- Kontoinhaber werden nur als Home-Assistant-Entity-IDs gespeichert.
- Importdateien werden nicht dauerhaft als Originaldatei gespeichert.
- Kontoarchive verändern keine historischen Buchungsdaten.
- Keine Konto- oder Personenzuordnung wird aufgrund eines gemeinsamen Kontos
  automatisch vorgenommen.

## Qualitätssicherung und Abnahmekriterien

Die Version ist fachlich abnahmefähig, wenn mindestens folgende Fälle getestet
sind:

- CAMT.053 erzeugt aus einer IBAN genau ein wiederverwendbares Konto.
- MT940 ohne IBAN speichert die Kontoangabe als `account_reference`.
- Ein zweiter Import desselben Kontos verwendet dieselbe `account_id`.
- Ein Konto kann null, eine oder mehrere Personen als Inhaber besitzen.
- Die Änderung eines Kontoinhabers ändert keine alte Buchungsaufteilung.
- Migration von Store-Version `1` erhält Planposten, Buchungen und Importe.
- Eine Buchung mit zwei Zielen wird gleichmäßig und centgenau verteilt.
- Ein manueller Betrag wie `60,00 / 20,00 / 20,00` wird akzeptiert.
- Eine nicht vollständig verteilte Buchung wird abgelehnt.
- Ein Rundungsrest wird deterministisch und sichtbar behandelt.
- `Haushalt + Hunde` wird als gemeinsame Zuordnung gespeichert.
- Nicht vorhandene oder doppelte Personenziele werden serverseitig abgelehnt.
- Frontend-API-Aufrufe funktionieren über Home-Assistant-Authentifizierung.
- Kein Test und kein Repository-Artefakt enthält private Konto- oder
  Buchungsdaten.

Die bestehende Node-Teststrecke und Python-Tests werden erweitert. Zusätzlich
werden die echte lokale Vorlage und anonymisierte MT940-/CAMT.053-Fixtures
für Parser- und Migrationsprüfungen verwendet.
