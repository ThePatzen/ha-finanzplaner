# Prüfworkflow

Die passende Prüfung richtet sich nach dem Änderungsumfang:

| Change scope | Required entrypoint |
| --- | --- |
| Markdown or skill-only change | `scripts/check-fast` plus `git diff --check` |
| One Python module or backend behavior | `scripts/test-file tests/<matching-file>.py` plus `scripts/check-fast` |
| Frontend helper or panel behavior | `scripts/test-file custom_components/finanzplaner/frontend/panel-utils.test.mjs` plus `node --check custom_components/finanzplaner/frontend/panel.js` |
| Storage, import, API, or cross-cutting behavior | `scripts/check-full` |
| Release preparation | `scripts/check-full` plus the release workflow document |

Für einzelne Backendmodule wird `<matching-file>.py` durch das passende
Testmodul unter `tests/` ersetzt. Die Prüfmatrix ist risikobasiert: Der
kleinste passende Einstiegspunkt wird ergänzt, wenn der Änderungsumfang eine
breitere Prüfung verlangt.

Fehlt Node.js, beenden Node-abhängige Prüfungen den Lauf mit Status 2. Das ist
als Umgebungsbeschränkung zu melden; es darf nicht als bestandene Frontend-
Prüfung ausgegeben werden.
