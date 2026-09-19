# Architektur

## 1. Runtime- und Distributionsgrenze

Finanzplaner ist eine Python-basierte Home-Assistant-Custom-Integration. Die
Verteilung erfolgt über HACS. Die Integration persistiert Daten lokal in Home
Assistant und liefert ein natives eingebettetes Panel mit HTML, CSS und
clientseitigem JavaScript aus.

## 2. Verzeichnisübersicht

- `custom_components/finanzplaner/`: Integration, Backend, API, Speicher, Importe, Sensoren und Services
- `custom_components/finanzplaner/frontend/`: statische Panel-Oberfläche, Helfer und Frontend-Tests
- `tests/`: Python-Tests
- `docs/`: Projektwissen sowie Pläne und Designspezifikationen
- `assets/`: visuelle und Distributions-Assets
- `template/`: Excel-Referenzvorlage mit privaten Referenzdaten

## 3. Backend-Datenfluss

Der Laufzeitfluss führt vom Config Flow über den Coordinator zu Storage und
Core. Daraus werden authentifizierte HTTP-Views sowie Sensoren und Services
bedient.

## 4. Import-Datenfluss

Hochgeladene MT940-, CAMT.053- oder Excel-Daten werden geparst und als
Vorschau aufbereitet. Danach werden sie validiert und entweder persistiert oder
ohne Mutation des bestehenden Speichers abgelehnt.

## 5. Frontend-Datenfluss

Das Panel stellt authentifizierte Home-Assistant-Anfragen. Die Antworten und
Benutzeraktionen werden im Panel-State verarbeitet, durch die Helfer in
`panel-utils.mjs` unterstützt und in natives Markup gerendert.

## 6. Risikoreiche Dateien und Verantwortlichkeiten

- `custom_components/finanzplaner/core.py`: fachliche Kernlogik und zentrale Geschäftsabläufe
- `custom_components/finanzplaner/storage.py`: lokales Persistenzmodell, Laden, Speichern und Migrationen
- `custom_components/finanzplaner/http.py`: authentifizierte HTTP-Views und API-Grenzen
- `custom_components/finanzplaner/coordinator.py`: Aktualisierung und Bereitstellung des Integrationszustands
- `custom_components/finanzplaner/frontend/panel.js`: Panel-State, Ereignisse, Ansichten und API-Nutzung
- `custom_components/finanzplaner/frontend/panel-utils.mjs`: testbare Frontend-Helfer für Formatierung und Zustandslogik

## 7. Reihenfolge der maßgeblichen Quellen

Bei widersprüchlichen oder unklaren Informationen gilt diese Reihenfolge:

1. `PRODUCT.md`
2. `README.md`
3. `CHANGELOG.md`
4. dieses Architektur-Dokument
5. fokussierte Quellen und Tests

Implementierungskörper und private Beispiele gehören nicht in dieses
Dokument.
