# Stone / Field — Stone Analyzer MVP v0.1

Eine responsive Angular-SPA für die digitale Dokumentation von Gesteins- und Mineralfunden. Die Identifikation in v0.1 ist ausdrücklich eine Demo: Das hochgeladene Foto wird nicht ausgewertet und es findet keine KI-Erkennung statt.

## Tech Stack

- Angular 21 mit Standalone Components, Angular Router und moderner Template-Syntax
- TypeScript, SCSS, Signals und Reactive Forms
- Asynchrones Repository mit IndexedDB für Analyseberichte und Originalbilder
- Vitest über den Angular Unit-Test-Builder

## MVP-Funktionen

- JPEG-, PNG- und WebP-Upload per Dateiauswahl oder Drag-and-drop, maximal 5 MB, mit Vorschau und Entfernen
- Optionale Angaben zu Fundort, Farbe, Größe und Beobachtungen
- Zeitverzögerte, zufällige Demo-Ergebnisse für Amethyst, Granit und Pyrit
- Ergebnisbericht mit Confidence-Stufe, Merkmalen, Kontext, Alternativen, Tests und Grenzen
- Analysehistorie mit Datum, Detailansicht und Löschen
- Originalbilddaten bleiben lokal als Binärdaten in IndexedDB; Base64 wird nicht verwendet

## Projektstruktur

```text
src/app/
├── core/
│   ├── repositories/  # Repository-Abstraktion und IndexedDB-Implementierung
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
3. Das Repository speichert Analyse und Originalbilddaten unter derselben Analyse-ID in IndexedDB.
4. Die Router-Seiten laden Berichte und Bilder über das Repository-Interface; die Historie zeigt Bildvorschauen.
5. Vorhandene LocalStorage-Analysen werden beim ersten Zugriff in IndexedDB übernommen. Der alte Eintrag wird erst nach erfolgreicher Migration entfernt.

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

Die Tests decken Upload-Validierung, Demo-Service und IndexedDB-Repository ab.

## Spätere Erweiterungen

- Backend-Endpunkt für echte Bildanalyse und sichere OpenAI-Anbindung
- Migration des Repositorys auf Supabase
- Authentifizierung und Synchronisierung zwischen Geräten
- Erweiterte Analyseberichte und Export

## Backend v0.2

Das optionale Backend liegt separat unter `server/` und verwendet Node.js, Express 5, TypeScript, Zod, Multer und das offizielle OpenAI SDK. Uploads werden nur im Arbeitsspeicher gehalten. Die Angular-App spricht ausschließlich den relativen Pfad `/api`; beim lokalen Dev-Server leitet `proxy.conf.json` diesen an `127.0.0.1:3000` weiter.

### Installation und Mock-Start

In zwei PowerShell-Terminals im Projektordner:

```powershell
npm install
npm install --prefix server
npm start
```

Im zweiten Terminal:

```powershell
npm run start:backend
```

Frontend und Backend starten standardmäßig im Mock-Modus. Die Analyzer-Seite nutzt in diesem Modus ausschließlich lokale Beispieldaten. Das Backend beantwortet `/api/health`; es lehnt Analyse-Requests ab, solange der Live-Modus nicht ausdrücklich eingeschaltet wurde.

### OpenAI Live-Modus bewusst einschalten

1. Erstelle `server/.env` aus `server/.env.example` (PowerShell: `Copy-Item server/.env.example server/.env`). Eine vorhandene `.env` nicht überschreiben.
2. Trage den persönlichen Schlüssel **nur** in `server/.env` als `OPENAI_API_KEY=sk-…` ein und setze `ANALYSIS_MODE=live`.
3. Ändere in `src/environments/environment.ts` `analysisMode` bewusst von `'mock'` auf `'live'`.
4. Starte das Frontend und Backend neu. Jeder Klick auf „KI-Analyse starten“ kann einen kostenpflichtigen OpenAI-Request auslösen.

Der API-Key wird weder in Angular-Konfigurationen noch an den Browser übertragen. Der Backend-Start verweigert Live-Modus bei fehlendem oder offensichtlich ungültigem Schlüssel. Die Prüfung bestätigt nicht per Netzwerkaufruf, ob ein Schlüssel vom OpenAI-Konto akzeptiert wird.

### API und Analyseformat

- `GET /api/health` → `{ "status": "ok" }`
- `POST /api/analyze` → `multipart/form-data` mit `image` und optional `location`, `color`, `size`, `notes`
- `POST /api/analyze/extended` → `multipart/form-data` mit `image` (Originalfoto), erforderlichen `location`, `color`, `size`, `notes`, dem validierten `previousReport` sowie null bis vier zusätzlichen `images`
- Erfolgsantwort: fachlicher Analysebericht mit `identification` (einschließlich `reasoning`), `summary`, `visibleFeatures`, `geologicalContext`, `alternatives`, `recommendedTests` und `limitations`

Das Backend prüft Bildsignatur und MIME-Typ, Feldlängen und strukturierte OpenAI-Ausgabe. Es ergänzt keine UUID oder Zeitstempel und speichert keine Ergebnisse. Angular versieht den Bericht nach Erfolg mit ID, Zeitstempel und Quelle und speichert Bericht und Originalbild lokal in IndexedDB. Bilder werden nicht mit dem Analysebericht an OpenAI zurückgegeben. Die lokalen Daten werden nicht zwischen Geräten synchronisiert. Zusätzlich zum Limit von fünf Anfragen pro Minute und IP gilt ein gemeinsames Limit von zehn gestarteten KI-Analysen pro UTC-Tag für Basis- und erweiterte Analysen. Der Zähler wird in `server/data/daily-usage.json` gespeichert und übersteht Backend-Neustarts, sofern das Serverlaufwerk persistent ist. Bei mehreren Backend-Instanzen oder Servern ist ein gemeinsamer zentraler Zähler (z. B. Redis oder Datenbank) nötig, sonst gilt das Tageslimit je Instanz. CORS lässt nur `FRONTEND_ORIGIN` zu; CORS ist kein Zugriffsschutz.

### Online-Betrieb und Grenzen

Die Anwendung ist noch nicht ohne Hosting-Konfiguration öffentlich bereit. Für einen einzelnen Server kann das Backend mit Node.js 20 oder neuer laufen; setze `ANALYSIS_MODE=live`, den OpenAI-Schlüssel als geheime Server-Umgebungsvariable und `FRONTEND_ORIGIN` auf die HTTPS-Adresse der Oberfläche. Der Webserver sollte die Angular-Builddateien aus `dist/stone-analyzer/browser` ausliefern und `/api` per Reverse Proxy an das Backend weiterleiten. Aktiviere HTTPS und speichere `server/data/daily-usage.json` auf persistentem Datenträger. `BACKEND_HOST=127.0.0.1` eignet sich für einen Reverse Proxy auf demselben Host; läuft das Backend in einem Container, muss es normalerweise an `0.0.0.0` gebunden und nur intern vom Proxy erreicht werden.

Es gibt aktuell keine Benutzerkonten oder Anmeldung. Jeder, der die URL kennt, kann daher eine Analyse versuchen; ein weitergeleiteter Link ist ebenfalls nutzbar. Das globale Tageslimit begrenzt die KI-Aufrufe insgesamt auf zehn pro Tag, reserviert sie aber nicht für dich und schützt nicht davor, dass Besucher oder Bots das Kontingent zuerst verbrauchen. Der OpenAI-Schlüssel bleibt auf dem Server. Vor einem größeren öffentlichen Start sollte zusätzlich ein Zugriffsschutz (z. B. Anmeldung oder ein serverseitiges Invite-System) und ein zentraler Quoten-Speicher für mehrere Instanzen ergänzt werden.

Die erweiterte Analyse startet vom Ergebnisbericht, übernimmt gespeicherte Beobachtungen als vorausgefüllte Pflichtfelder und akzeptiert bis zu vier optionale Zusatzbilder. Das Originalfoto wird automatisch erneut mitgesendet. Nach erfolgreicher Analyse überschreibt das neue Ergebnis den bestehenden Bericht unter derselben ID; Zeitstempel und History-Eintrag bleiben erhalten, und die Bildliste wird atomar aktualisiert. Für diesen Ablauf stellt das Backend den separaten Endpunkt `/api/analyze/extended` bereit und sendet den vorherigen fachlichen Bericht, das Originalfoto, die Pflichtangaben und gewählte Zusatzbilder an das KI-Modell. Bereits gespeicherte Basis-/Erweiterungs-Paare werden beim nächsten Datenbankzugriff zusammengeführt. Die Verarbeitung kann länger dauern und zusätzliche API-Kosten verursachen.

## Fundkarte

Die Fundkarte `/map` zeigt gespeicherte Analysen mit optionalen GPS- oder manuell ausgewählten Koordinaten. Standortkoordinaten werden zusammen mit der Analyse lokal in IndexedDB gespeichert und nicht an das Analyse-Backend oder OpenAI übertragen. Ältere Analysen ohne Standort bleiben gültig und können auf der Fundkarte nachträglich ergänzt werden. GPS wird erst nach einem Klick angefragt und erfordert einen sicheren Browserkontext (HTTPS; lokal ist `localhost` erlaubt).

Die Karte verwendet MapLibre GL JS mit dem Vektorkartenstil von OpenFreeMap. Die Anbieter-Attribution wird in der Karte angezeigt; OpenFreeMap erhält beim Laden Anfragen für den dargestellten Ausschnitt. Für den öffentlichen OpenFreeMap-Dienst ist kein API-Schlüssel erforderlich. Der Kartenrenderer ist von der Datenhaltung getrennt: Fundorte und Marker bleiben lokal in IndexedDB.

### Backend-Entwicklung und Tests

```powershell
npm run build:backend
npm run test:backend
npm run build
npm test -- --watch=false
```

Die Backend-Tests mocken den OpenAI-Client. Sie führen keine kostenpflichtigen API-Aufrufe aus.
