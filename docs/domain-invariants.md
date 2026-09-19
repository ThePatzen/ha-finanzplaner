# Fachliche und technische Invarianten

## 1. Datenschutz

Vollständige IBANs und rohe Bankdaten bleiben lokal. API, Oberfläche, Logs und
öffentliche Dateien verwenden maskierte Kontodaten. Relevante Grenzen liegen
in `custom_components/finanzplaner/http.py`, `core.py` und den fokussierten
Payload- und Importtests, insbesondere `tests/test_account_payloads.py` und
`tests/test_account_import.py`.

## 2. Persistenz

Schemaänderungen erfordern eine Migration und Regressionstestabdeckung. Ein
Reload in Version 2 bewahrt stabile IDs und historische Snapshots. Direkte
Änderungen an Home-Assistant-`.storage`-Dateien sind verboten. Maßgebliche
Stellen sind `storage.py`, `core.py` und `tests/test_accounts_and_migration.py`.

## 3. Kontosemantik

Kontoinhaber beschreiben Zahlungsquellen und sind nicht automatisch
Buchungsziele. Diese Trennung wird in `core.py`, `http.py` und
`tests/test_allocation_payloads.py` abgesichert.

## 4. Zuordnungssemantik

Ziele, Bereiche, Kategorien, Projekte und Tiere bleiben getrennt. Positive
Cent-Zuordnungen müssen exakt dem absoluten Buchungsbetrag entsprechen. Die
fachliche Kernlogik liegt in `core.py`; relevante Regressionen stehen in
`tests/test_allocation_payloads.py` und `tests/test_finanzplaner_core.py`.

## 5. Importsicherheit

Abgelehnte Importe verändern den Speicher nicht. Doppelte Importe bleiben
prüfbar und erzeugen keine zweite übernommene Buchung. Relevante Einstiegspunkte
sind die Importer unter `custom_components/finanzplaner/importers/`,
`storage.py` und `tests/test_account_import.py`.

## 6. Regelsemantik

Nur gültige, eindeutige Treffer mit höchster Priorität dürfen automatisch
übernommen werden. Konflikte bleiben zur Prüfung offen. Die Regeln liegen in
`core.py` und `http.py`; fokussierte Abdeckung bieten `tests/test_rules.py` und
`tests/test_rule_payloads.py`.

## 7. Releasesemantik

Version, `CHANGELOG.md` und Git-Tag bewegen sich nur nach ausdrücklicher
Releasefreigabe gemeinsam. Die genaue Reihenfolge steht in
`docs/workflows/release.md`; Versionsdaten liegen in
`custom_components/finanzplaner/manifest.json`.

Diese Invarianten nennen Quellen und fokussierte Testmodule, reproduzieren aber
keine privaten Werte.
