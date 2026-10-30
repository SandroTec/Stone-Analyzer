# Stone / Field — Stone Analyzer MVP v0.1

Eine responsive Angular-SPA für die digitale Dokumentation von Gesteins- und Mineralfunden. Die Identifikation in v0.1 ist ausdrücklich eine Demo: Das hochgeladene Foto wird nicht ausgewertet und es findet keine KI-Erkennung statt.

## Tech Stack

- Angular 21 mit Standalone Components, Angular Router und moderner Template-Syntax
- TypeScript, SCSS, Signals und Reactive Forms
- Versionierte LocalStorage-Persistenz hinter einem asynchronen Repository-Interface
- Vitest über den Angular Unit-Test-Builder

## MVP-Funktionen

- JPEG-, PNG- und WebP-Upload per Dateiauswahl oder Drag-and-drop, maximal 5 MB, mit Vorschau und Entfernen
- Optionale Angaben zu Fundort, Farbe, Größe und Beobachtungen
- Zeitverzögerte, zufällige Demo-Ergebnisse für Amethyst, Granit und Pyrit
- Ergebnisbericht mit Confidence-Stufe, Merkmalen, Kontext, Alternativen, Tests und Grenzen
- Analysehistorie mit Datum, Detailansicht und Löschen
- Keine Bilddateien oder Base64-Bilder werden gespeichert

## Projektstruktur

```text
src/app/
├── core/
│   ├── repositories/  # Repository-Abstraktion und LocalStorage-Implementierung
│   └── services/      # Simulierter Analyse-Service
├── features/
│   ├── analyzer/      # Analyzer und Upload-Validierung
│   ├── history/       # Historie
│   └── results/       # Ergebnisbericht
└── shared/models/     # Analyse-Request und Ergebnis-Typen
```

## Datenfluss

1. Die Analyzer-Seite validiert Bildtyp und Dateigröße und zeigt eine lokale Vorschau.
2. Der Analyse-Service simuliert die Verarbeitung und erstellt einen klar als Demo markierten Beispielbericht.
3. Das Repository speichert strukturierte Daten unter `stone-analyzer.analyses.v1` samt Schema-Version, UUID und Zeitstempel.
4. Die Router-Seiten laden einzelne Berichte oder die chronologisch sortierte Historie über das Repository-Interface.

Das Repository-Interface kann später durch eine Supabase-Implementierung ersetzt werden. In v0.1 gibt es keine Supabase-, Authentifizierungs-, Backend- oder OpenAI-Abhängigkeiten.

## Lokal starten

Voraussetzungen: Node.js und npm passend zur installierten Angular CLI.

```bash
npm install
npm start
```

Die Anwendung ist anschließend unter `http://localhost:4200` verfügbar.

## Build und Tests

```bash
npm run build
npm test
```

Die Tests decken Upload-Validierung, Demo-Service und LocalStorage-Repository ab.

## Spätere Erweiterungen

- Backend-Endpunkt für echte Bildanalyse und sichere OpenAI-Anbindung
- Migration des Repositorys auf Supabase
- Authentifizierung und Synchronisierung zwischen Geräten
- Erweiterte Analyseberichte und Export
