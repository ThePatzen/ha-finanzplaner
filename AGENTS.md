# Arbeitsanweisungen

Prüfe vor jeder Änderung im Repository zuerst diese Dokumente:

- [PRODUCT.md](PRODUCT.md) für Produktziele, Funktionsumfang und Leitplanken
- [README.md](README.md) für den aktuellen Nutzungs- und Installationsstand
- [CHANGELOG.md](CHANGELOG.md) für bisherige und geplante Änderungen

Richte die Umsetzung an diesen Dokumenten aus und halte sie bei relevanten Änderungen konsistent.

## Kurzüberblick über Stack und Struktur

- Stack: Python-basierte Home-Assistant-Custom-Integration mit nativer eingebetteter Oberfläche aus HTML, CSS und clientseitigem JavaScript. Verteilung über HACS, lokale Persistenz, Tests mit Python `unittest` und Node `--test`.
- `custom_components/finanzplaner/`: Integration, API, Speicher, Importe, Sensoren und Services.
- `custom_components/finanzplaner/frontend/`: statische Panel-Oberfläche und zugehörige Node-Tests.
- `tests/`: Python-Tests; `docs/superpowers/{plans,specs}/`: Pläne und Designspezifikationen.
- `assets/` und `template/`: visuelle Assets und Excel-Referenzvorlage. Die Vorlage enthält private Referenzdaten und gehört nicht in Änderungen oder Ausgaben.

## Token- und Arbeitsprozess-Leitlinien

- Lies zuerst nur die vorgeschriebenen Projektdokumente und danach gezielt die Dateien und Ausschnitte, die für die Aufgabe relevant sind. Gib große Dateien nicht vollständig aus.
- Suche mit `rg` oder `rg --files`, bevor du Verzeichnisse oder Dateien breit öffnest. Formuliere Suchmuster eng und begrenze Treffer sowie Zeilenbereiche.
- Begrenze Tool-Ausgaben auf den benötigten Umfang. Filtere Logs und Diffs früh, setze passende Ausgabegrenzen und teile große Ausgaben in gezielte Abschnitte.
- Führe voneinander unabhängige, schreibgeschützte Prüfungen parallel aus. Warte nur bei echten Abhängigkeiten sequenziell und wiederhole bereits erledigte Abfragen nicht.
- Halte während der Arbeit kurze interne Notizen zu Befunden, Annahmen und offenen Punkten. Lade bereits geprüften Kontext nicht erneut, solange sich die Dateien nicht geändert haben.
- Passe Planung und Erklärung an die Aufgabengröße an. Kleine Änderungen brauchen keinen ausführlichen Plan; ein fokussierter Patch ist umfangreichen Umschreibungen vorzuziehen.
- Ändere nur den relevanten Bereich. Vermeide unbeteiligte Formatierungsänderungen, vollständige Datei-Neuerzeugung und unnötige Anpassungen an Zeilenenden.
- Delegiere nur eigenständige Aufgaben, bei denen der Nutzen die Kosten für Kontextübergabe und Abstimmung übersteigt.
- Verifiziere proportional zum Risiko: Bei Dokumentationsänderungen reichen Diff- und Formatprüfung; bei Codeänderungen kommen die passenden fokussierten Tests hinzu. Überspringe notwendige Prüfungen nicht allein wegen Tokenersparnis.
- Halte Statusmeldungen und die abschließende Übergabe knapp. Verlinke betroffene Dateien, fasse Änderungen und Prüfergebnisse zusammen und kopiere keine großen Quelltext- oder Logblöcke.

## Verbindliche Frontend-Regel

Bei jeder Arbeit an HTML, CSS, clientseitigem JavaScript, Layout, Navigation,
Formularen, Tabellen, Zuständen, Barrierefreiheit oder visueller Politur muss
die Skill `$impeccable` verwendet werden. Ihre Nutzung ist verpflichtend und
darf nicht übersprungen oder durch eine eigene Vorgehensweise ersetzt werden.

`$impeccable` muss vor Beginn der UI-Arbeit erfolgreich geladen werden. Wenn
der Launcher oder ein erforderlicher Skill-Schritt nicht funktioniert, muss die
UI-Arbeit pausieren, bis das Problem behoben ist.
