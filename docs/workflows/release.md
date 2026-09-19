# Releaseworkflow

Ein Release folgt genau dieser Reihenfolge:

1. Ausdrückliche Release-Autorisierung bestätigen.
2. `custom_components/finanzplaner/manifest.json` und `CHANGELOG.md` auf
   dieselbe Semantic-Version aktualisieren.
3. Die vollständige Prüfsuite ausführen und `git diff --check` prüfen.
4. Erst nach erfolgreicher Prüfung den passenden lokalen Tag
   `vMAJOR.MINOR.PATCH` erstellen.
5. GitHub-Befehle, Pushes und die Veröffentlichung eines Releases nur mit
   ausdrücklicher Autorisierung und der erforderlichen externen Freigabe
   verwenden.

Die Harness-Arbeit selbst ändert keine Versionsmetadaten und veröffentlicht
nichts.
