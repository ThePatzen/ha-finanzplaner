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

## Fix-Runde 1

### Review-Finding

Der neue Allocation-Endpoint übergab bislang den vollständigen Request-Body an
`parse_allocation_payload()`. Dadurch wurde der öffentliche Wrapper
`{"allocations": [...]}` abgelehnt und die nicht spezifizierte nackte Liste
akzeptiert.

### Korrektur

- `BookingAllocationsView` verlangt nun einen JSON-Objekt-Wrapper und darin ein
  Feld `allocations` vom Typ Liste.
- Nur die enthaltene Liste wird an `parse_allocation_payload()` übergeben; dessen
  pures Listen-Interface blieb unverändert.
- Fehlende, leere, falsch typisierte oder als nackte Liste gesendete Wrapper
  liefern HTTP 400, ohne Buchung, Store oder Refresh-Zähler zu verändern.
- Der Erfolgstest und die bestehenden View-Validierungstests verwenden nun die
  spezifizierte Wrapperform. Ein zusätzlicher Regressionstest deckt fehlende,
  leere und falsche Wrapperformen ab.
- Legacy-Endpoint, Live-Target-Prüfung, centgenaue Servervalidierung und
  Response-Redaction blieben unverändert und sind weiterhin durch die
  fokussierten Tests abgedeckt.

### TDD-Nachweis

Der neue Regressionstest lief vor der Implementierung rot: Der Wrapper-Erfolg
endete mit HTTP 400, während die nackte Liste ohne Fehler angenommen wurde.

### Prüfungen

```text
python3 -m unittest tests.test_allocation_payloads.BookingAllocationViewTests -v
OK — 7 Tests

python3 -m unittest tests.test_allocation_payloads -v
OK — 12 Tests

python3 -m unittest tests.test_allocation_payloads tests.test_finanzplaner_core -v
OK — 22 Tests

python3 -m compileall -q custom_components tests
OK

git diff --check
OK
```

### Bedenken

Keine offenen Bedenken.
