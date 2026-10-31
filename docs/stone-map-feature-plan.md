# Fundkarte: Architektur- und Umsetzungsplan

**Status:** Fundkartenfunktion implementiert; Basiskarte am 31.10.2026 von Leaflet/OSM-Raster auf MapLibre GL JS/OpenFreeMap-Vektor migriert. Angular-Build und Kartenressourcen geprüft; Browserdarstellung hier nicht manuell erreichbar.
**Ziel:** Fundorte optional erfassen, lokal einer Analyse zuordnen und auf einer interaktiven Karte verwalten.

## Aktueller Kartenaufbau

Die Kartenansichten verwenden MapLibre GL JS mit dem Vektorstil `https://tiles.openfreemap.org/styles/bright`. Fundpunkte und Cluster werden als GeoJSON-Quelle im Renderer gezeichnet; die Standortauswahl nutzt MapLibre-Marker und Kartenklicks. Die Anbieter-Attribution ist in der Karte sichtbar. OpenFreeMap erhält beim Laden den dargestellten Ausschnitt; für den öffentlichen Dienst ist laut Anbieter kein API-Schlüssel nötig. [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/), [OpenFreeMap Quick Start](https://openfreemap.org/quick_start/)

Die Umstellung entfernt Leaflet und `leaflet.markercluster`. Sie ändert weder `FindLocation` noch IndexedDB: Koordinaten bleiben optional und lokal, Bilder und Historieneinträge bleiben unverändert. MapLibre wird lazy geladen; sein Worker wird als statisches Angular-Asset ausgeliefert. Kartenfehler werden im UI angezeigt und können über **„Karte erneut laden“** erneut angefordert werden. Die Browseransicht konnte in dieser Umgebung nicht manuell aufgerufen werden.

## 1. Relevante bestehende Architektur

- **Frontend:** Angular 21.2, TypeScript 5.9, Standalone Components, Angular Router, Reactive Forms und Signals. `angular.json` baut die SPA mit `@angular/build:application`; globale Styles liegen in `src/styles.scss`.
- **Shell und Navigation:** `src/app/app.ts`, `app.html` und `app.scss` bilden den gemeinsamen Rahmen. Die Navigation enthält Analyzer und Historie.
- **Routing:** `src/app/app.routes.ts` lädt Analyzer, History, Ergebnisbericht und erweiterte Analyse lazy.
- **Datenmodell:** `src/app/shared/models/stone-analysis.model.ts` definiert `AnalysisRequest`, `StoneAnalysis` und `AnalysisReport`. Das Textfeld `observations.location` speichert bereits eine optionale, vom Nutzer beschriebene Ortsangabe, aber keine Koordinaten.
- **Analysefluss:** `AnalyzerPage` validiert und zeigt das Bild, sammelt optionale Beobachtungen und ruft `StoneAnalysisService.analyzeStone()` auf. Im Live-Modus sendet der Service Multipart-Daten an `/api/analyze`; im Demo-Modus wird lokal eine Beispielanalyse gewählt. Danach speichert der Service Analyse und Bild über `AnalysisRepository`.
- **Erweiterte Analyse:** `ExtendedAnalysisPage` startet vom Ergebnisbericht. `StoneAnalysisService.analyzeExtended()` überschreibt bei Erfolg denselben Eintrag unter derselben ID. Die Standortdaten müssen dabei erhalten bleiben.
- **Persistenz:** `AnalysisRepository` ist die bestehende Abstraktion. `IndexedDbAnalysisRepository` hält Analysen im Object Store `analyses` und Bildbytes im Object Store `images`. `save(analysis)` ohne Bildargument lässt vorhandene Bilder bestehen; Bildlisten können gemeinsam mit dem Bericht aktualisiert werden. Bestehende LocalStorage-Datensätze werden nur noch einmalig migriert; außerdem führt die aktuelle Implementierung frühere Basis-/Erweiterungs-Duplikate zusammen.
- **State-Management:** Es gibt keinen globalen Store. Seiten laden Daten asynchron über das Repository und halten UI-Zustand in lokalen Signals. Für die Fundkarte ist dieselbe Vorgehensweise ausreichend.
- **Backend:** `server/src/app.ts` und `server/src/services/openai.service.ts` verarbeiten Textangaben und Bilder, persistieren aber keine Analysen. Geokoordinaten sollen für diese Funktion lokal bleiben und nicht an `/api/analyze` oder `/api/analyze/extended` übertragen werden.

> Die Aufgabenbeschreibung nennt LocalStorage als bestehende Persistenz. Im aktuellen Code ist IndexedDB die aktive Persistenz; LocalStorage ist ausschließlich eine Quelle für die einmalige Migration alter Analysen. Der Plan baut deshalb auf dem IndexedDB-Repository auf und führt keine zweite Persistenz ein.

## 2. Empfohlene Lösung

### Datenmodell

Das bestehende Textfeld `observations.location` bleibt unangetastet: Es ist eine frei formulierte Ortsnotiz und wird derzeit bei Live-Analysen an das Backend gesendet. Koordinaten kommen als separates optionales Feld hinzu:

```ts
interface FindLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  source: 'gps' | 'manual';
  updatedAt: string;
}

interface StoneAnalysis {
  // bestehende Felder bleiben erhalten
  findLocation?: FindLocation;
}
```

Koordinaten müssen endlich und im gültigen Bereich liegen (Breitengrad −90 bis 90, Längengrad −180 bis 180). `findLocation` bleibt optional, sodass alte Einträge und Analysen ohne Standort weiterhin gültig sind. `source` kennzeichnet, ob die Koordinate vom Browser-GPS oder durch Kartenauswahl stammt. Bei manueller Verschiebung wird eine zuvor angegebene GPS-Genauigkeit entfernt.

Diese additive Modelländerung benötigt voraussichtlich keine IndexedDB-Versionserhöhung: Datensätze ohne `findLocation` bleiben lesbar. Die Persistenzvalidierung in `isAnalysis()` soll das neue Feld, falls vorhanden, prüfen und fehlende Standortdaten akzeptieren. Für eine spätere Supabase-Migration kann `findLocation` als JSONB übernommen oder in Latitude-/Longitude-Spalten beziehungsweise einen PostGIS-Punkt abgebildet werden; der Repository-Vertrag kapselt den späteren Wechsel.

### Komponenten und Datenfluss

- Eine wiederverwendbare Standalone-`LocationPickerComponent` bietet die Aktion **„Aktuellen Standort verwenden“**, eine Karte zur manuellen Auswahl und die Möglichkeit, eine Auswahl zu entfernen. Sie nimmt einen optionalen Startwert an und gibt `FindLocation | null` aus.
- Der Analyzer zeigt den Picker optional an. GPS oder Kartenklick aktualisieren einen lokalen Signalwert; beim Speichern ergänzt `StoneAnalysisService` diesen Wert zum Datensatz. Koordinaten gehen nicht in FormData und nicht an OpenAI.
- Die erweiterte Analyse übernimmt `base.findLocation`. Sie kann denselben Picker zum Ändern oder Entfernen anbieten. Weil die Analyse bestehende Datensätze überschreibt, muss ein nicht geänderter Standort erhalten bleiben.
- Eine lazy geladene `StoneMapPageComponent` lädt `AnalysisRepository.getAll()`, filtert gültige `findLocation`-Werte und zeichnet sie. Ein Marker-Klick wählt einen Datensatz aus; eine Angular-Preview zeigt Gesteinsname, Bild und den Link **„Analyse öffnen“**. Eine Angular-Preview außerhalb des Leaflet-Popups vermeidet HTML-Interpolation in Leaflet-Markern und bleibt mit Signals/Router zugänglich.
- In der Fundkarten-Seite gibt es auch eine Liste **„Ohne Fundort“**. So können ältere Analysen nachträglich ergänzt werden, ohne sie aus dem Analyzer neu erstellen zu müssen. Beim Hinzufügen, Ändern oder Entfernen wird der bestehende Analysedatensatz mit `repository.save()` aktualisiert; Bilder werden dabei nicht überschrieben.
- Die Navigation erhält einen Eintrag **„Fundkarte“** und das Routing z. B. `path: 'map'`.

### Leaflet und OpenStreetMap

- Leaflet sowie die zu Angular/TypeScript passende Typdefinition werden als Projektabhängigkeiten ergänzt, wenn die Implementierung beginnt. Leaflet-CSS wird als globaler Style in `angular.json` eingebunden.
- Karten werden erst nach dem Rendern des Host-Elements initialisiert; beim Zerstören der Component werden Map-Instanz und Listener mit `map.remove()` bereinigt. Nach Sichtbarkeits- oder Größenwechseln wird die Kartengröße invalidiert. Eigene CSS-`DivIcon`s vermeiden fehleranfällige Pfade zu Leaflet-Standardmarkerbildern.
- Die Fundkarte gruppiert nahe Marker mit einem Marker-Cluster-Plugin; ein Klick auf einen Cluster zoomt auf dessen Inhalte. Ein einzelner Marker öffnet die Angular-Preview. Das Plugin ist eine zusätzliche Abhängigkeit, aber für überlagernde Funde ein klarer UX-Nutzen.
- Kartenbasis im MVP: HTTPS-Kacheln des OpenStreetMap-Standarddiensts, mit dauerhaft sichtbarer Attribution **© OpenStreetMap contributors** und Link zur Lizenz. Die URL bleibt in einer kleinen Map-Konfiguration austauschbar.
- Die OSM-Kachelrichtlinie verlangt korrekte Attribution und URL, respektiertes Caching und untersagt Bulk-Downloads beziehungsweise Offline-Prefetch. Der Standarddienst ist best-effort ohne Verfügbarkeitsgarantie. Bei steigender Nutzung oder kommerziellem Betrieb sollte vorab ein OSM-abgeleiteter Kachelanbieter mit passender Nutzungsvereinbarung gewählt werden. Die Karte lädt nur Kacheln des tatsächlich betrachteten Ausschnitts. [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- Leaflet unterstützt Attribution, Popups und `invalidateSize()` für geänderte Containergrößen; Karteninstanzen werden beim Abbau explizit entfernt. [Leaflet API-Referenz](https://leafletjs.com/reference.html)

### GPS, Datenschutz und UX

- Die GPS-Abfrage erfolgt ausschließlich nach einem bewussten Klick. Sie nutzt `navigator.geolocation.getCurrentPosition()` und zeigt verständliche Zustände für verweigerte Berechtigung, Timeout, fehlende Unterstützung und Positionsfehler.
- GPS funktioniert nur in einem sicheren Kontext (HTTPS; `localhost` ist für lokale Entwicklung speziell behandelt). Desktop-Nutzer können direkt die Karte anklicken. GPS-Genauigkeit wird angezeigt; ungenaue Werte werden nicht stillschweigend verworfen, sondern als Hinweis angezeigt und können manuell korrigiert werden.
- Ein Fundort ist optional. Ohne GPS-Freigabe, Kartenauswahl oder Koordinate kann die Analyse unverändert gespeichert und genutzt werden.
- Geokoordinaten verbleiben in IndexedDB. Sie werden weder an das Analyse-Backend noch an OpenAI übertragen. Beim Anzeigen oder Verschieben der Karte erhält der Kachelserver jedoch Anfragen, aus denen sich der gerade betrachtete Kartenausschnitt ableiten lässt; diese externe Kartenverarbeitung muss in der UI/Datenschutzhinweisen transparent sein.
- Die bestehende Textangabe `observations.location` bleibt separat. Es wird keine automatische Reverse-Geocodierung ergänzt; diese würde einen weiteren Dienst und zusätzliche Übermittlung von Koordinaten erfordern.

## 3. Vorgeschlagene Dateien

### Bestehende Dateien

- `src/app/shared/models/stone-analysis.model.ts` — optionalen Standorttyp und `findLocation` ergänzen; `AnalysisRequest` nur erweitern, falls die Auswahl dort mitgeführt wird.
- `src/app/core/repositories/indexed-db-analysis.repository.ts` — optionale Standortdaten bei der Persistenzvalidierung akzeptieren; `save()`-Semantik für reine Metadatenänderungen beibehalten.
- `src/app/core/repositories/analysis.repository.ts` — voraussichtlich kein neuer Vertrag nötig; vorhandenes `getAll()` und `save()` decken Karte, Nachpflege und Löschen des Standortfeldes ab.
- `src/app/core/services/stone-analysis.service.ts` — Standort beim Basisbericht speichern und bei erweiterter Analyse erhalten, ohne Koordinaten an die API zu hängen.
- `src/app/features/analyzer/analyzer-page/analyzer-page.ts` — optionalen Picker einbinden und Standort an den Service übergeben.
- `src/app/features/results/extended-analysis-page/extended-analysis-page.ts` — vorhandene Koordinate übernehmen und optional editierbar machen.
- `src/app/app.html`, `src/app/app.scss` — Navigationseintrag zur Fundkarte ergänzen.
- `src/app/app.routes.ts` — lazy Route zur Fundkarte ergänzen.
- `angular.json` — Leaflet-CSS ergänzen.
- `src/styles.scss` — bei Bedarf Kartenhöhen und mobile Kartenregeln global ergänzen.
- `README.md` — Fundkarte, lokale Standortpersistenz und OSM-Nutzung dokumentieren.

### Neue Dateien

- `src/app/shared/models/find-location.model.ts` — falls der Standorttyp nicht im bestehenden Analysemodell verbleiben soll; Empfehlung: eigener Typ für Wiederverwendung.
- `src/app/shared/components/location-picker/location-picker.ts` — GPS-/Karten-Auswahl mit Outputs und Barrierefreiheitszuständen.
- `src/app/features/map/stone-map-page/stone-map-page.ts` — Fundkarte, Marker, Preview sowie Liste ohne Standort.
- `src/app/features/map/map-config.ts` — Kachel-URL, Attribution und Initialzoom an einer austauschbaren Stelle.
- Tests neben den neuen Komponenten sowie Erweiterungen an `indexed-db-analysis.repository.spec.ts` und `stone-analysis.service.spec.ts`.

## 4. Schrittweiser Implementierungsplan

### Phase 1 — Standorttyp und Persistenz

**Ziel:** Standortdaten optional und rückwärtskompatibel in bestehende Analysen aufnehmen.

**Dateien:** `stone-analysis.model.ts` (oder neues `find-location.model.ts`), `indexed-db-analysis.repository.ts`, `indexed-db-analysis.repository.spec.ts`.

**Änderungen:** `FindLocation`-Typ mit Quellenangabe und GPS-Genauigkeit anlegen; Wertebereich validieren; `findLocation` optional an `StoneAnalysis` ergänzen. IndexedDB bleibt die einzige aktive Persistenz. Ein fehlender Standort in alten/migrierten Einträgen darf Lesen, Sortieren, Aktualisieren oder Löschen nicht verhindern.

**Abhängigkeit:** Keine.

**Akzeptanzkriterien:** Alte Fixtures ohne Koordinate werden unverändert geladen; gültige Koordinate bleibt nach Speichern und erneuter Abfrage identisch; ungültige Werte werden zurückgewiesen oder nicht als Kartenfund angezeigt; Bilddaten bleiben bei einer Metadatenaktualisierung unverändert.

**Risiken:** Zu strenge Analysevalidierung könnte alte Datensätze aussperren. Deshalb nur das optionale Feld validieren, wenn es existiert, und keinen unnötigen IDB-Schemawechsel auslösen.

### Phase 2 — Leaflet-Basis und wiederverwendbarer Picker

**Ziel:** Eine optionale, testbare Standortauswahl mit manueller Karte und GPS schaffen.

**Dateien:** `package.json`, `package-lock.json`, `angular.json`, `src/app/shared/components/location-picker/location-picker.ts`, neue Picker-Tests, `map-config.ts`.

**Änderungen:** Leaflet plus kompatible Types installieren; CSS und konfigurierbare Tile-Layer-URL/Attribution einbinden. Die Picker-Component erhält optionalen Ausgangswert und emittiert Koordinaten oder `null`. Map click setzt einen manuellen Marker. GPS startet nur auf Button-Klick; Fehler, Genauigkeit und Ladezustand werden sichtbar. Leaflet-Instanz und Eventhandler werden sicher abgebaut.

**Abhängigkeit:** Phase 1.

**Akzeptanzkriterien:** Klick auf die Karte setzt/verschiebt den Marker; GPS-Erfolg setzt Koordinate samt Genauigkeit; Ablehnung/Timeout bleibt verständlich und blockiert manuelle Auswahl nicht; Entfernen emittiert `null`; Attribution ist sichtbar; bei Verlassen wird keine zweite Map-Instanz zurückgelassen.

**Risiken:** Browser-Geolocation benötigt sicheren Kontext und Nutzerfreigabe. Leaflet-Marker-Assets können im Angular-Build fehlen; eigene `DivIcon`s umgehen den Pfadfehler.

### Phase 3 — Optionaler Fundort beim Analysieren

**Ziel:** Fundort ohne Pflichtschritt in die Analyse und lokale Speicherung übernehmen.

**Dateien:** `analyzer-page.ts`, `stone-analysis.model.ts`, `stone-analysis.service.ts`, zugehörige Service-Tests.

**Änderungen:** Picker optional in die Analyzer-Seite integrieren. Koordinate lokal im Komponenten-State halten und erst beim erfolgreichen Speichern an den Analyse-Datensatz hängen. Sicherstellen, dass Koordinaten weder im Multipart-Formular noch im Backend-Prompt landen. Vorhandene optionale Textangabe bleibt erhalten.

**Abhängigkeit:** Phase 2.

**Akzeptanzkriterien:** Analyse ohne Standort funktioniert wie bisher; manuell gesetzte/GPS-Koordinate erscheint im gespeicherten Datensatz; API-Request enthält keine Koordinaten; bei Backendfehler wird nichts als Analyse gespeichert.

**Risiken:** Standortzustand darf bei Bildwechsel oder Analysefehler nicht versehentlich verloren gehen. Im Demo- und Live-Modus muss die Persistenz gleich funktionieren.

### Phase 4 — Fundkarte und Navigation

**Ziel:** Alle Analysen mit gültigem Standort auf einer mobilen und Desktop-Karte darstellen.

**Dateien:** `stone-map-page.ts`, `app.routes.ts`, `app.html`, `app.scss`, Map-Konfiguration, Marker-Cluster-Abhängigkeit und Styles.

**Änderungen:** Lazy Route `/map`, Navigationseintrag, Leaflet-Karte und Marker-Cluster. `getAll()` liefert die lokale Datenquelle; die Page filtert nur gültige Koordinaten. Marker-Klick aktualisiert eine Angular-Preview mit Bild, Name, Confidence/Datum und Router-Link zum vollständigen Ergebnis. Cluster werden bei Nähe zusammengefasst. Keine Standortdaten werden doppelt gespeichert.

**Abhängigkeit:** Phase 1 und 2; Phase 3 ist für neue Funde nötig, aber Karte kann mit vorhandenen Testdaten unabhängig aufgebaut werden.

**Akzeptanzkriterien:** Nur Analysen mit gültigem Standort erhalten Marker; Preview zeigt korrektes Bild oder Platzhalter; Router-Link öffnet denselben Analysebericht; mehrere nahe Marker sind anwählbar; Karte und Preview passen sich auf kleinen Viewports an; Attribution bleibt sichtbar.

**Risiken:** OSM-Standardkacheln sind best-effort und dürfen nicht massenhaft vorab geladen werden. Cluster und Karte müssen nach Kartencontainer-Größenwechseln `invalidateSize()` erhalten.

### Phase 5 — Bestehende Funde ergänzen und Standorte verwalten

**Ziel:** Fundorte für vorhandene Analysen hinzufügen, ändern und entfernen.

**Dateien:** `stone-map-page.ts`, `location-picker.ts`, `indexed-db-analysis.repository.ts`, Repository-Tests, `extended-analysis-page.ts` und ggf. `stone-analysis.service.ts`.

**Änderungen:** Map-Page zeigt zusätzlich eine Liste von Analysen ohne Koordinate. Ein Fund kann aus dieser Liste oder Marker-Preview in den Picker gelangen. Speichern aktualisiert nur `findLocation`; Entfernen löscht nur dieses Feld. Erweiterte Analyse erhält bisherigen Standort, sofern der Picker ihn nicht verändert oder explizit entfernt. Änderungen werden nach erfolgreichem IndexedDB-Schreiben in der UI aktualisiert.

**Abhängigkeit:** Phasen 2 und 4.

**Akzeptanzkriterien:** Standort kann bei einem Eintrag ohne Koordinate ergänzt werden; ein bestehender Standort kann verschoben und entfernt werden; Bericht und Bilder bleiben dabei unverändert; nach Reload entspricht die Karte den gespeicherten Daten.

**Risiken:** Veraltete Component-Daten könnten Analysefelder überschreiben. Nur Standortdaten aus dem aktuellen Analyseobjekt ändern und vor Erfolg keine UI-Änderung als persistiert anzeigen.

### Phase 6 — Integration, Datenschutz und Dokumentation

**Ziel:** End-to-End-Verhalten und Kartenbetrieb absichern.

**Dateien:** relevante Angular-Tests, `README.md`, bei Bedarf Karten-/Privacy-Hinweis in UI.

**Änderungen:** Builds und Tests für Modellvalidierung, IDB-Rückwärtskompatibilität, Speicherfluss, Picker-Zustände, Filter und Preview ergänzen. OSM-Attribution, Datenübermittlung, Geolocation-Berechtigung und Grenzen der GPS-Genauigkeit dokumentieren.

**Abhängigkeit:** Phasen 1–5.

**Akzeptanzkriterien:** Build und Tests erfolgreich; keine Analyse ohne Standort wird beeinträchtigt; Geo-Koordinaten tauchen in keinem API-Request auf; OSM-Attribution sichtbar; Map funktioniert auf 320 px ohne horizontales Scrollen und ohne zurückgelassene Marker-/Map-Instanzen nach Navigation.

**Risiken:** Leaflet/Marker-Cluster können globale CSS- und Marker-Asset-Annahmen haben. Früh im Build verifizieren und Kartenstyles auf Leaflet-Container begrenzen.

## 5. Aufwand und offene Entscheidungen

- **Aufwand:** mittel. Datenmodell und IndexedDB-Änderung sind klein; Leaflet-Lifecycle, GPS-Fehlerzustände, responsive Kartenfläche und Editierfluss sind der Hauptaufwand.
- **Tile-Anbieter:** Empfehlung fürs MVP: OSM-Standard-Rasterkacheln mit sichtbarer Attribution und strikt interaktiver Nutzung. Vor öffentlicher oder intensiver Nutzung ist die aktuelle Tile-Policy erneut zu prüfen und gegebenenfalls ein Anbieter mit SLA zu wählen.
- **Reverse Geocoding:** Nicht Teil des MVP. Die vorhandene Ortsnotiz bleibt frei editierbar; keine Koordinate wird an Nominatim oder einen anderen Geocoding-Dienst gesendet.
- **Cluster:** Empfehlung: Leaflet.markercluster einsetzen, wenn mehr als wenige Funde erwartet werden. Falls Abhängigkeiten minimiert werden sollen, zunächst exakt gleiche Koordinaten gruppieren und nahe Punkte über Zoom/Bounds auseinanderführen.
- **Genauigkeitsschwelle:** Empfehlung: GPS-Genauigkeit nur als Hinweis anzeigen (z. B. Warnung oberhalb 250 m), nicht als harte Sperre. Grenzwert vor Phase 2/3 anhand gewünschter UX bestätigen.
- **Standortquelle:** Empfehlung: manuelle Änderung setzt `source: 'manual'` und entfernt `accuracyMeters`; GPS setzt `source: 'gps'` und speichert die gelieferte Genauigkeit.

## 6. Empfohlener Start

Mit **Phase 1 (Standorttyp und Persistenz)** beginnen. Sie legt fest, wie Koordinaten rückwärtskompatibel und ohne Bildverlust gespeichert werden, bevor Leaflet oder GPS in die UI kommen. Danach lässt sich Picker und Map schrittweise darauf aufbauen.
