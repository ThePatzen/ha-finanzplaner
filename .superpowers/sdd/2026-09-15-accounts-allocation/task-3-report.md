# Task 3 Bericht: Authentifizierte Konten-API

## Ergebnis und Dateien

Task 3 des v0.3.0-Plans ist umgesetzt. Die API liefert Konten ausschließlich
mit maskierten Kennungen, validiert Änderungen gegen aktuell vorhandene
`person.*`-Entities plus `household` und mutiert den Store erst nach vollständig
erfolgreicher Validierung.

Geändert wurden:

- `custom_components/finanzplaner/http.py`
- `custom_components/finanzplaner/__init__.py`
- `tests/test_account_payloads.py`
- `.superpowers/sdd/2026-09-15-accounts-allocation/task-3-report.md`

`custom_components/finanzplaner/__init__.py` wurde gemäß dem im Ledger
dokumentierten Ruling zusätzlich geändert, damit beide neuen Views in
`async_setup()` registriert und erreichbar sind.

## Implementierung

- `account_payload()` entfernt das interne Vollfeld `iban`, erzeugt
  `iban_masked` aus den letzten vier Zeichen der normalisierten IBAN und
  redigiert auch eine IBAN-gleiche `account_reference`, ohne den Store zu
  verändern.
- `validate_account_update()` akzeptiert ausschließlich ein nichtleeres Label,
  eine Liste eindeutiger bekannter Ziele und einen booleschen Aktivstatus. Das
  Ergebnis enthält nur `label`, `owner_targets` und `active`.
- `AccountsView` stellt `GET /api/finanzplaner/accounts` bereit.
- `AccountView` stellt `POST /api/finanzplaner/accounts/{account_id}` bereit.
  Unbekannte Konten liefern 404, ungültiges JSON oder ungültige Felder 400.
  Nach erfolgreicher Validierung werden nur die editierbaren Felder und
  `updated_at` geändert, danach wird gespeichert und der Coordinator erneuert.
- Beide Views setzen `requires_auth = True` und werden neben den bestehenden
  authentifizierten Views registriert.
- Die zentrale `_response_payload()`-Redaction bleibt bestehen und verarbeitet
  nun auch strukturierte Werte unter einem Schlüssel `account` rekursiv.

## TDD-Befehle und Ergebnisse

1. `python3 -m unittest tests.test_account_payloads -v`
   - RED: 12 Tests liefen gegen den unveränderten Produktionscode; 16 Fehler
     wegen der fehlenden Helper und Views.
2. `python3 -m unittest tests.test_account_payloads -v`
   - Zwischenlauf: 11 Tests bestanden, ein Test deckte eine vollständige
     `account_reference` im POST-Antwortwrapper auf.
3. `python3 -m unittest tests.test_account_payloads -v`
   - GREEN: 12 Tests bestanden.
4. Neuer Privacy-Vertrag für eine IBAN-gleiche `account_reference`:
   `python3 -m unittest tests.test_account_payloads.AccountPayloadTests.test_account_payload_redacts_iban_used_as_account_reference -v`
   - RED: erwartete vollständige Referenz statt `…5678`.
5. `python3 -m unittest tests.test_account_payloads -v`
   - GREEN: 13 Tests bestanden.
6. `python3 -m unittest tests.test_account_payloads tests.test_accounts_and_migration -v`
   - GREEN: 17 Tests bestanden.
7. `python3 -m compileall -q custom_components tests`
   - GREEN: Exit-Code 0, keine Ausgabe.
8. Zusätzliche Regression:
   `python3 -m unittest tests.test_account_import -v`
   - GREEN: 10 Tests bestanden.

## Commit

- `feat: add authenticated account API`

## Selbstreview

- Die Voll-IBAN bleibt im Store unverändert und erscheint weder in
  `account_payload()` noch in GET-/POST-Antworten.
- Validierung und Ermittlung der Live-Ziele sind abgeschlossen, bevor
  `account.update()` aufgerufen wird; Fehler speichern oder refreshen nicht.
- Der Update-Helper gibt nur die drei freigegebenen editierbaren Felder zurück.
- 404 wird vor dem Lesen beziehungsweise Validieren des Update-Payloads
  ausgelöst, wenn die Konto-ID unbekannt ist.
- Beide Routen sind authentifiziert und durch einen Offline-Registrierungstest
  abgedeckt.
- Der bestehende Import-Redaction-Test bleibt grün.
- `git diff --check` meldet keine inhaltlichen Fehler; Git weist lediglich auf
  die bestehende LF→CRLF-Konvertierung der beiden Python-Dateien hin.

## Bedenken

Die lokale Testumgebung enthält kein echtes Home Assistant. Die View- und
Registrierungsverträge werden deshalb mit kleinen vollständigen Test-Doubles
ausgeführt. Store-Mutation, Statuscodes, Live-Person-Filter, Persistenz- und
Refresh-Aufrufe sind damit abgedeckt; ein echter HA-HTTP-Integrationstest ist
in diesem Workspace nicht möglich.
