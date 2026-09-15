# Task 5 Report: Geldgenaue Aufteilungsvalidierung und API

## Status

Task 5 ist vollständig umgesetzt. Es wurden keine Arbeiten aus späteren Tasks vorgezogen und keine privaten Daten oder Originaldateien gespeichert.

## Umsetzung

- `parse_allocation_payload(payload, total, valid_targets)` validiert nicht leere Listen vollständig, bevor `Allocation`-Objekte erzeugt werden.
- Beträge werden mit `Decimal(str(value))` geprüft. Boolesche, nicht numerische, nicht endliche, nicht positive und Beträge mit mehr als zwei Nachkommastellen werden abgelehnt; es findet keine stille Rundung statt.
- Die Summe muss exakt `abs(total)` entsprechen. Bei Abweichungen wird exakt `ValueError("Die Aufteilung deckt den Buchungsbetrag nicht centgenau ab.")` ausgelöst.
- Targets müssen eindeutig und in der Menge aktueller Home-Assistant-`person.*`-Entitäten plus `household` enthalten sein. Kontoinhaber aus gespeicherten Accounts werden nicht als Booking-Ziele verwendet.
- `area` akzeptiert nur `None` oder `Hunde`; `category` und `project` akzeptieren optionale Strings.
- Der authentifizierte Endpoint `POST /api/finanzplaner/bookings/<booking_id>/allocations` wurde implementiert und registriert.
- Die neue API liefert 404 für unbekannte Buchungen und 400 für ungültige Requests. Der Store wird erst nach erfolgreicher vollständiger Validierung mutiert.
- Bei Erfolg werden Allocation-Dicts gespeichert, der Status auf `resolved` gesetzt, der Store gespeichert, der Coordinator aktualisiert und die zentral redigierte Buchung zurückgegeben.
- Der Legacy-Endpoint bleibt bestehen und führt seine automatisch mit `split_amount()` erzeugte Aufteilung durch dieselbe Payload-Validierung gegen Live-Ziele.

## TDD-Nachweis

Der erste fokussierte Lauf schlug erwartungsgemäß fehl, weil `parse_allocation_payload` noch nicht existierte:

```text
ImportError: cannot import name 'parse_allocation_payload'
FAILED (errors=1)
```

Nach der Implementierung bestand der fokussierte Lauf mit 11 Tests. Der kombinierte Lauf bestand mit 21 Tests.

## Prüfungen

```text
python3 -m unittest tests.test_allocation_payloads -v
OK — 11 Tests

python3 -m unittest tests.test_allocation_payloads tests.test_finanzplaner_core -v
OK — 21 Tests

python3 -m unittest discover -s tests -v
OK — 57 Tests

python3 -m compileall -q custom_components tests
OK

git diff --check
OK
```

## Selbstreview

- Keine Store-Mutation vor Abschluss der Payload-, Summen- und Live-Target-Validierung.
- Keine stille Quantisierung in der neuen Payload-Validierung.
- `Hunde` wird als Bereich modelliert; das gemeinsame Ziel bleibt `household`.
- Response-Redaction wird am bestehenden zentralen Boundary weiterverwendet und mutiert keine gespeicherten Daten.
- Die einzige Änderung außerhalb der vier primären Task-Dateien ist die laut Brief erlaubte, zuvor fehlende Registrierung in `custom_components/finanzplaner/__init__.py` sowie dieser geforderte Bericht.

## Bedenken

Keine offenen Bedenken.
