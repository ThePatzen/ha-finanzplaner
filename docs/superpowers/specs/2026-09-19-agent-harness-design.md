# Agent-Harness für den Finanzplaner

## Ziel

Das Repository erhält einen kleinen, belastbaren Agent-Harness, der neue
Agenten schnell zu den relevanten Produkt-, Architektur- und Workflow-
Informationen führt. Der Harness soll unnötiges Lesen großer Dateien
vermeiden, die wichtigsten fachlichen Grenzen explizit machen und verlässliche
Verifikationsbefehle anbieten.

Der Harness verändert keine Finanzplaner-Funktionalität, kein Datenmodell und
keine Release-Version. Er dokumentiert und prüft ausschließlich den
Entwicklungsprozess.

## Ausgangslage

Das Repository ist eine Python-basierte Home-Assistant-Custom-Integration mit
lokaler Persistenz, nativer eingebetteter Panel-Oberfläche und HACS-Verteilung.
Die Produktwahrheit liegt in `PRODUCT.md`, der aktuelle Nutzer- und
Installationsstand in `README.md` und die Änderungshistorie in `CHANGELOG.md`.

Es gibt bereits ein kurzes `AGENTS.md`, den Projekt-Skill
`skills/ha-finanzplaner/` und den lokal entdeckbaren Skill
`.agents/skills/impeccable-project/`. Der Projekt-Skill enthält jedoch
historische Release- und Testangaben und soll nicht weiter als parallele
Architektur- oder Produktdokumentation wachsen. Kanonische Skill-Inhalte
werden künftig unter `.agents/skills/` organisiert.

Der Arbeitsbaum kann bei der Umsetzung bereits uncommitted Änderungen an
Produkt- und Anwendungscode enthalten. Harness-Änderungen dürfen solche
Änderungen weder überschreiben noch mitspeichern.

## Leitprinzipien

1. `AGENTS.md` enthält nur operative Regeln, Grenzen, eine Inhaltsübersicht
   und die kleinsten relevanten Einstiege.
2. Dauerhafte Architektur- und Domänenkenntnis liegt in `docs/` und wird nur
   bei passender Aufgabe gelesen.
3. Skills sind kurze, bedingte Arbeitsanweisungen. Sie verlinken auf die
   Dokumentation, statt sie zu duplizieren.
4. Prüfskripte sind die ausführbare Quelle für wiederkehrende Checks.
5. Kleine Änderungen verwenden die kleinste sinnvolle Prüfung; vollständige
   Prüfungen gelten für Querschnittsänderungen, Releases oder ungeklärte
   Risiken.
6. Keine privaten Excel-, Bank- oder Home-Assistant-Daten werden in
   Dokumentation, Fixtures, Logs oder Skill-Beispiele übernommen.
7. Frontend-Arbeiten verwenden weiterhin verpflichtend `$impeccable` und
   `impeccable-project`.

## Zielstruktur

### Root-Anweisungen

`AGENTS.md` wird auf eine kurze, operative Einstiegsschicht erweitert und
enthält:

- Zweck und Stack des Repositorys
- Inhaltsübersicht mit Links zu Produkt, Architektur, Domäne und Workflows
- Verzeichnis- und Zuständigkeitskarte
- unveränderliche Datenschutz-, Storage- und Domänenregeln
- Arbeitsablauf für Backend, Import, Storage und Panel
- Verifikations-Einstiegspunkte
- Release- und Übergaberegeln

Es werden zunächst keine verschachtelten `AGENTS.md`-Dateien angelegt. Eine
verschachtelte Anweisung ist erst sinnvoll, wenn ein Unterbaum tatsächlich
abweichende Regeln benötigt.

### Dauerhafte Dokumentation

Folgende Dokumente bilden die gezielte Wissensschicht:

- `docs/architecture.md`: Komponenten, Datenfluss und wichtige Einstiegspunkte
- `docs/domain-invariants.md`: stabile IDs, Migrationen, Maskierung,
  Aufteilungen, Importe und fachliche Trennungen
- `docs/workflows/testing.md`: risikobasierte Prüfmatrix und Befehle
- `docs/workflows/release.md`: Manifest, CHANGELOG, HACS und Release-Sicherheit

Die Dokumente referenzieren konkrete Dateien und Funktionen, kopieren aber
keine großen Quelltextabschnitte oder vollständige API-Dokumentationen.

### Ausführbare Prüfungen

Unter `scripts/` entstehen drei stabile Einstiegspunkte:

- `check-fast`: günstige Syntax-, Compile-, JSON- und Diff-Prüfungen
- `test-file <path>`: fokussierte Python- oder Node-Prüfung für eine Datei
- `check-full`: vollständige Python- und Frontend-Tests sowie alle statischen
  Prüfungen

Fehlt Node.js, melden Frontend-Prüfungen die konkrete Umgebungseinschränkung
und liefern keinen falschen grünen Vollstatus. Die vorhandenen Python- und
statischen Prüfungen bleiben unabhängig davon ausführbar.

### Skills

`.agents/skills/ha-finanzplaner/` wird der kanonische Projekt-Skill. Er enthält
stabile Projektorientierung, Trigger und Links zu den Dokumenten. Die bisherige
zweite Skill-Kopie unter `skills/ha-finanzplaner/` wird auf ihre Verbraucher
geprüft und anschließend entweder entfernt oder als expliziter Kompatibilitäts-
Wrapper auf die kanonische Fassung reduziert.

Spezialisierte Skills werden schrittweise ergänzt:

- `ha-finanzplaner-backend`
- `ha-finanzplaner-storage`
- `ha-finanzplaner-imports`
- `ha-finanzplaner-frontend`
- `ha-finanzplaner-verification`
- `ha-finanzplaner-release`

Jeder Skill nennt Trigger, zuerst zu lesende Dateien, relevante Invarianten,
Prüfbefehle und typische Fehler. Die Skills bilden keine neue Produkt- oder
API-Wahrheit.

## Wichtige Repository-Grenzen

- `custom_components/finanzplaner/core.py` enthält Domänenlogik,
  Validierung, Forecasting und Bankparser.
- `storage.py` ist die Grenze für Persistenz, Normalisierung und Migrationen.
- `http.py` enthält authentifizierte Views und die Maskierungsgrenze für
  Antworten.
- `frontend/panel.js` ist das native Panel; `panel-utils.mjs` und die
  zugehörige Testdatei bilden den fokussierten Frontend-Testeinstieg.
- Vollständige IBANs und unveränderte Bankdaten bleiben lokal und gehören
  nicht in API, UI, Logs, öffentliche Dateien oder Beispiele.
- Kontoinhaber beschreiben Zahlungsquellen und werden nicht automatisch zu
  Buchungszielen.
- Schemaänderungen erfordern Migration und Regressionstests; direkte
  Home-Assistant-`.storage`-Änderungen sind verboten.
- Version, CHANGELOG und Git-Tag werden nur bei ausdrücklicher Release-
  Freigabe gemeinsam geändert.

## Nicht Bestandteil dieser Änderung

- keine neue Finanzplaner-Funktion
- keine Umstrukturierung der großen Anwendungsdateien
- keine CI-, GitHub-, HACS- oder Release-Veröffentlichung
- keine automatische Installation zusätzlicher Laufzeitabhängigkeiten
- keine privaten Referenzdaten oder echten Bankdateien

## Abnahmekriterien

Der Harness ist erfolgreich eingeführt, wenn:

1. `AGENTS.md` als kurzer Einstieg alle relevanten Wissensbereiche verlinkt.
2. Keine aktive Arbeitsanweisung veraltete Release- oder Teststände als
   aktuell behauptet.
3. `check-fast`, `test-file` und `check-full` die vorhandenen Prüfungen
   reproduzierbar und mit klaren Fehlern ausführen.
4. Der Projekt-Skill unter `.agents/skills/` entdeckt wird und auf die
   kanonische Dokumentation verweist.
5. Die fachlichen und sicherheitsrelevanten Invarianten in genau einer
   gezielten Dokumentationsschicht beschrieben sind.
6. Die bestehenden Nutzeränderungen im Arbeitsbaum unverändert bleiben.
7. Keine Produktversion und kein Release-Artefakt durch den Harness geändert
   wird.
