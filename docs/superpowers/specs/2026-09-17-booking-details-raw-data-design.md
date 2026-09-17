# Buchungsdetails und verlustfreie Quelldaten

**Stand:** 2026-09-17  
**Status:** Entwurf zur Prüfung  
**Repository:** `ThePatzen/ha-finanzplaner`

## Ziel

Die Ansichten „Ungeklärte Buchungen“ und „Übernommene Buchungen“ sollen für
jede Buchung eine gemeinsame Detailansicht als natives Popup anbieten. Die
Ansicht soll die gespeicherten fachlichen Daten, die Kontoerkennung, die
Aufteilung sowie die Erkennungs- und Regelinformationen vollständig
nachvollziehbar machen.

Zusätzlich soll der Import keine buchungsbezogenen Quelldaten verwerfen. Die
normalisierten Felder bleiben für Matching, Auswertungen und die bestehende
Oberfläche erhalten; ergänzend wird eine verlustfreie Quellrepräsentation des
jeweiligen Buchungssatzes gespeichert.

## Ausgangslage

Die aktuelle `Booking`-Struktur enthält nur die normalisierten Felder Konto,
Datum, Betrag, Währung, Verwendungszweck, Referenz und Zahlungsempfänger. Der
MT940-Parser verwendet derzeit im Wesentlichen `:25:`, `:61:` und `:86:`.
Der CAMT.053-Parser extrahiert Betrag, Währung, Datum, `Ustrd`,
`EndToEndId` und `Nm`; weitere Tags und verschachtelte Transaktionsdaten
werden nicht an die gespeicherte Buchung weitergegeben.

Originaldateien werden bisher nach dem Import nicht dauerhaft gespeichert.
Diese Erweiterung ändert das nicht grundsätzlich: Gespeichert wird die
vollständige Quelldarstellung des Buchungssatzes mit Importbezug, nicht eine
separate unveränderte Bankdatei als Downloadarchiv.

## Festgelegter Umfang

### Detailansicht

Beide Buchungslisten erhalten pro Eintrag einen Button „Details“. Dieser öffnet
dieselbe Detailansicht unabhängig vom Status der Buchung.

Die Ansicht enthält mindestens:

- Status und Buchungs-ID
- Buchungsdatum, Betrag und Währung
- erkanntes Konto mit Anzeigename und maskierter Kontoreferenz
- Zahlungsempfänger und sämtliche gespeicherten Referenzfelder
- Verwendungszweck
- gespeicherte Aufteilungen mit Ziel, Betrag und historischen Namen von
  Bereich, Kategorie, Projekt und Tier
- bei ungeklärten Buchungen den aktuellen Regelstatus, Regelvorschlag,
  Treffergrund und Konflikt-IDs
- bei übernommenen Buchungen die gespeicherte Zuordnungsquelle,
  Regel-Snapshot und Übernahmeinformationen
- Importdatei, Format, Datei-Hash und Datensatznummer, sofern vorhanden

Fehlende Werte werden ausdrücklich als „Nicht vorhanden“ angezeigt. Es werden
keine Felder durch eine pauschale Whitelist im Frontend stillschweigend
ausgeblendet; neue gespeicherte Buchungsfelder sollen über die gemeinsame
Darstellung ebenfalls nachvollziehbar bleiben.

### Rohdatenansicht

Ein Button „Rohdaten anzeigen“ schaltet innerhalb des Popups eine lesbare,
formatierte JSON-Ansicht der gespeicherten Buchung inklusive `source_data` ein.
Die Ansicht ist nicht editierbar, nutzt ein semantisches `pre`-Element mit
Zeilenumbruch und bleibt auch bei langen Verwendungszwecken oder unbekannten
Feldern horizontal beziehungsweise vertikal nutzbar.

`source_data` enthält:

- Importformat
- Dateiname, Datei-Hash und Datensatznummer
- die vollständigen MT940-Zeilen des Buchungssatzes einschließlich unbekannter
  Tags und Fortsetzungszeilen
- beim CAMT.053 den vollständigen semantischen `<Ntry>`-Baum einschließlich
  unbekannter verschachtelter Elemente, Textwerte, Attribute und
  Namespace-Informationen
- den zugehörigen Konto-/Statement-Kontext, soweit er für die Zuordnung des
  Buchungssatzes relevant ist

Die normalisierten Felder und die Quelldaten werden getrennt gespeichert. Ein
Fehler in der Normalisierung darf die Rohdaten nicht überschreiben.

## Datenmodell

Neue Buchungen erhalten neben den bestehenden Feldern ein optionales Feld:

```json
{
  "source_data": {
    "format": "MT940",
    "filename": "konto-2026-09.sta",
    "file_sha256": "…",
    "record_index": 3,
    "record": {
      "kind": "mt940_transaction",
      "lines": [":61:…", ":86:…"]
    },
    "context": {
      "lines": [":20:…", ":25:…"]
    }
  }
}
```

Die konkrete JSON-Repräsentation des CAMT-Baums wird rekursiv und
JSON-kompatibel definiert, beispielsweise mit `tag`, `namespace`,
`attributes`, `text` und `children`. Es werden keine XML-Elemente anhand
einer bekannten Feldliste entfernt.

Für Buchungen aus älteren Speicherständen bleibt `source_data` optional. Die
Detailansicht zeigt dann „Für diese Buchung wurden beim damaligen Import keine
Quelldaten gespeichert.“ Eine nachträgliche Rekonstruktion aus den bereits
normalisierten Feldern findet nicht statt.

Die bestehende Duplikaterkennung bleibt unverändert. Wird ein Import als
Duplikat verworfen, wird keine zweite Buchung angelegt. Die Quelldaten einer
bereits vorhandenen Buchung werden dabei nicht ungefragt überschrieben.

## Parser- und Importverhalten

Die Parser liefern neben der normalisierten `Booking` zusätzlich einen
verlustfreien Quell-Datensatz und die erforderlichen Kontextdaten. Die
Normalisierung der bisherigen Felder und die Bildung des Fingerprints bleiben
fachlich stabil.

Für MT940 wird jeder vollständige Abschnitt vom Buchungsmarker `:61:` bis vor
den nächsten Buchungsmarker beziehungsweise bis zum Ende des relevanten
Statements erfasst. Unbekannte Tags, mehrzeilige Inhalte und
Fortsetzungszeilen bleiben in ihrer Reihenfolge erhalten. Der
Statement-/Kontokontext wird separat referenziert oder gespeichert, damit er
nicht als Buchungsfeld fehlinterpretiert wird.

Für CAMT.053 wird jeder vollständige `<Ntry>`-Knoten in eine rekursive,
namespace-bewahrende JSON-Struktur überführt. Die bisherige Extraktion der
normalisierten Werte läuft weiterhin über diesen Datensatz. Dadurch bleiben
beispielsweise zusätzliche `TxDtls`, Bank- und Remittance-Informationen sowie
proprietäre Unterknoten verfügbar, auch wenn sie für Matching und Auswertung
nicht verwendet werden.

Der Import versieht jede akzeptierte Buchung mit Format-, Datei- und
Datensatzbezug. Bei ZIP-Importen gilt dieser Bezug für die einzelne enthaltene
Datei, nicht nur für das äußere Archiv.

## API

Es wird ein neuer authentifizierter GET-Endpunkt ergänzt:

```text
GET /api/finanzplaner/bookings/{booking_id}/details
```

Die bestehende POST-Bedeutung von
`/api/finanzplaner/bookings/{booking_id}` bleibt unverändert.

Die Antwort liefert mindestens:

```json
{
  "booking": {},
  "account": {},
  "details": {
    "status": "unresolved",
    "suggestion": {},
    "matched_rule": {},
    "allocations": []
  },
  "source_data": {}
}
```

Die Projektion für ungeklärte und übernommene Buchungen nutzt dieselbe
Detail-Logik, ergänzt aber jeweils die statusabhängigen Informationen. Nicht
vorhandene Daten werden als `null`, leere Liste oder fehlendes optionales Feld
geliefert und vom Frontend verständlich beschriftet.

Alle Antworten laufen weiterhin durch `_response_payload`. Vollständige IBANs
und eingebettete Kontoreferenzen werden daher auch innerhalb von
`source_data`, Freitext, XML-Texten und Regelhinweisen maskiert. Die
vollständige Quelle bleibt ausschließlich im lokalen persistenten Speicher.

## Frontend

Die Oberfläche verwendet ein gemeinsames natives `<dialog>` im bestehenden
Panel. Das Dialog-Markup wird bei den beiden Listen nicht dupliziert.

Beim Öffnen:

1. merkt sich die Oberfläche den auslösenden Button,
2. öffnet das Dialog mit `showModal()`,
3. lädt die Details über den neuen Endpunkt,
4. zeigt einen Lade-, Fehler- oder Erfolgszustand,
5. setzt nach dem Schließen den Fokus auf den ursprünglichen „Details“-Button
   zurück.

Das Popup enthält eine klare Überschrift, einen expliziten Schließen-Button,
eine semantische Feld-/Wertdarstellung und einen sichtbaren Bereich für
Aufteilungen. „Rohdaten anzeigen“ und „Fachliche Details anzeigen“ bleiben
innerhalb desselben Dialogs umschaltbar. Escape-Schließen, Fokusverhalten,
ausreichender Kontrast, sichtbare Fokusmarkierung und mobile Scrollbarkeit
werden berücksichtigt. Rohdaten werden ausschließlich als Text eingefügt und
nicht als HTML interpretiert.

Die bestehenden Aktionen wie Aufteilung speichern, Zuordnung rückgängig und
Auswahl löschen bleiben außerhalb des Detaildialogs unverändert. Das Öffnen
der Detailansicht verändert keine Buchung.

## Sicherheit und Datenschutz

- Rohdaten werden lokal gespeichert, weil der Nutzer sie ausdrücklich zur
  Fehlerprüfung benötigt.
- Die API gibt keine vollständigen IBANs oder Kontoreferenzen zurück.
- Rohdaten werden nicht in Logs geschrieben.
- Der Dialog bietet keine Bearbeitung oder erneuten Import aus Rohdaten an.
- Die Detailansicht zeigt nur Daten der angeforderten Buchung; eine allgemeine
  Importdatei-Downloadfunktion ist nicht Teil dieses Umfangs.
- Die Produktdokumentation wird auf die neue lokale Aufbewahrung der
  Buchungssatz-Quelldaten angepasst.

## Migration

Die bestehende Speichermigration lässt Buchungen ohne `source_data` gültig.
Neue Importdaten werden ausschließlich im aktuellen Schema gespeichert. Es
werden keine privaten Quelldaten aus der lokalen Excel-Vorlage oder aus
Beispieldateien in das Repository übernommen.

## Tests und Abnahmekriterien

Backend:

- MT940 bewahrt unbekannte Tags und Fortsetzungszeilen pro Buchung auf.
- CAMT.053 bewahrt unbekannte verschachtelte Elemente, Attribute und Texte
  vollständig auf.
- Einzeldatei- und ZIP-Import setzen korrekten Datei- und Datensatzbezug.
- Duplikate überschreiben keine bestehende Quelldarstellung.
- Der Detail-Endpunkt liefert ungeklärte und übernommene Buchungen.
- Nicht authentifizierte Detailanfragen werden abgewiesen.
- IBANs bleiben auch in verschachtelten Rohdaten maskiert.
- Legacy-Buchungen ohne Quelle liefern einen verständlichen Hinweis.

Frontend:

- Beide Listen rendern einen zugänglichen „Details“-Button.
- Das Popup lädt und zeigt fachliche Details für beide Statusarten.
- Rohdaten lassen sich ein- und ausblenden und werden als escaped Text
  dargestellt.
- Fehler-, Lade- und leere Zustände sind abgedeckt.
- Escape und Schließen-Button schließen das Popup; der Fokus kehrt zurück.
- Bestehende Zuordnungs-, Auswahl- und Löschaktionen bleiben funktionsfähig.

Abnahme ist erreicht, wenn eine importierte Buchung mit absichtlich
unbekannten MT940-/CAMT-Feldern diese Felder im Rohdatenbereich wiederzeigt,
ohne dass die normale Erkennung oder die Kontomaskierung beschädigt wird.

