---
version: 1
slug: "finanzuebersicht"
primary_target: "custom_components/finanzplaner/frontend/panel.js"
related_targets: []
---

# Finanzübersicht

## Scope und Modus

Erster Bildschirm der Home-Assistant-Integration. Operate-Oberfläche für den schnellen Haushaltsüberblick; der aktuelle Monat ist der Standardkontext.

## Besucher und Aufgabe

Mehrere Personen eines gemeinsamen Haushalts prüfen gemeinsam, ob der Monat im Plan liegt. Die wichtigste Aufgabe ist die schnelle Einordnung: Wie weit liegen Planung, Prognose und Ist auseinander? Die wichtigste Folgeaktion ist, ungeklärte Buchungen direkt zu öffnen und zuzuordnen.

## Beweis und Inhalt

Die Oberfläche zeigt eine Gesamtbilanz, den direkten Vergleich Planung · Prognose · Ist, die erwartete Monatsentwicklung, die Anzahl ungeklärter Buchungen und einen direkten Einstieg in deren Liste. Demonstrationswerte sind als synthetisch zu behandeln; echte Werte kommen später aus Planpositionen, Importen und Zuordnungen.

## Grenzen

Keine zweite Navigationsebene im ersten Blick. Keine versteckten Statusinformationen, die nur über Farbe verständlich sind. Ein Statusfeld bleibt der visuelle Anker; die Prüfliste ist kompakt und handlungsorientiert. Die Oberfläche muss in Home Assistant als native Panel-Oberfläche funktionieren und auf schmalen Ansichten in sinnvoller Reihenfolge stapeln.

## Gewählte Richtung und Moment

Gewählt ist die „Synoptische Haushaltskarte“ mit der Komposition „Statusfeld mit Prüfstreifen“. Der Memoriermoment ist der eine Blick auf den Monatsstatus: eine harte, ruhige Gegenüberstellung von Planung, Prognose und Ist, neben der eine markierte Prüffront die noch offenen Buchungen zählt. Der Status darf nicht wie ein dekoratives Dashboard wirken, sondern muss sofort eine Entscheidung ermöglichen.

## Offene Entscheidungen

Noch offen sind die endgültigen Datenquellen und Sensor-Namen für Summen, Forecast und offene Buchungen, die genaue Import- und Zuordnungsinteraktion sowie die Detaildarstellung von Personen-, Hunde- und Projektanteilen. Diese Entscheidungen dürfen die erste Informationshierarchie nicht verändern.

## Direction contract

### THESIS

Die Finanzübersicht ist eine synoptische Monatskarte: Planung, Prognose und Ist werden in einem dominanten Statusfeld direkt gegeneinander lesbar. Sie verweigert das übliche verstreute Kachel-Dashboard, bei dem die wichtigste Abweichung erst zusammengesucht werden muss.

### OWN-WORLD

Die Welt nutzt tiefes Marineblau als Orientierung, warmes Kartenpapier als ruhige Arbeitsfläche und Cyan, Amber sowie Koralle als semantische Markierungen. Dünne Isolinien, feste Kanten, tabellarische Ziffern und kleine präzise Etiketten geben dem Bildschirm den Charakter eines Prognoseplans. Farbe wird immer durch Text, Position oder Symbol ergänzt.

### STORY

Beim Öffnen versteht der Haushalt zuerst den aktuellen Monatsstatus, dann die Richtung der Abweichung und anschließend den Grund für Unsicherheit. Ein Klick auf den Prüfstreifen führt direkt zu den ungeklärten Buchungen. Von dort kann eine Buchung einer oder mehreren Personen, „Haushalt“ oder „Hunde“ zugeordnet und aufgeteilt werden.

### FIRST VIEWPORT

Im linken, tiefblauen Rand stehen Produktname, aktueller Monat und die knappe Navigation. Im Hauptfeld stehen oben Zeitraum und Gesamtbilanz; darunter nimmt der Vergleich „Planung · Prognose · Ist“ den größten visuellen Raum ein. Rechts sitzt der kompakte Prüfstreifen mit Anzahl und direkter Aktion. Am unteren Rand schließt eine zusammenfassende Haushaltsbilanz den Blick ab. Die primäre Aktion ist der Einstieg in die ungeklärten Buchungen.

### FORM

Gewählt ist die Form „Synoptische Haushaltskarte“, Position 1 der Richtungsentscheidung, mit Seed-Key `0ef43f85`. Die Komposition ist „Statusfeld mit Prüfstreifen“, die erste der drei geprüften Kompositionsvarianten; der verbindliche Referenz-Comp liegt unter `.impeccable/mocks/decision/assigned.png`.

### FINISH

unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
