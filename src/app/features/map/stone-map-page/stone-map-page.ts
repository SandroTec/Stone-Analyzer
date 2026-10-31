import { DatePipe, DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { AnalysisRepository } from '../../../core/repositories/analysis.repository';
import { StoneAnalysis } from '../../../shared/models/stone-analysis.model';
import { FindLocation, isFindLocation } from '../../../shared/models/find-location.model';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, invalidateMapSize, loadMapLibre, MAP_STYLE_URL } from '../map-config';

const SOURCE_ID = 'find-locations';
const CLUSTER_LAYER_ID = 'find-clusters';
const CLUSTER_COUNT_LAYER_ID = 'find-cluster-count';
const POINT_LAYER_ID = 'find-points';

@Component({
  selector: 'app-stone-map-page',
  imports: [DatePipe, DecimalPipe, RouterLink, LocationPickerComponent],
  template: `
    <section class="map-page">
      <p class="eyebrow">FELDNOTIZEN · FUNDKARTE</p>
      <div class="heading"><div><h1>Deine Fundkarte</h1><p>Gespeicherte Fundorte bleiben auf diesem Gerät.</p></div><a routerLink="/">+ Neue Analyse</a></div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <div class="map-frame">
        <div #mapElement class="map-view" role="application" aria-label="Karte aller gespeicherten Gesteinsfunde"></div>
        <div class="map-zoom-controls" role="group" aria-label="Kartenzoom">
          <button type="button" (click)="zoomIn()" [disabled]="zoomLevel() >= 19" aria-label="Karte vergrößern">+</button>
          <button type="button" (click)="zoomOut()" [disabled]="zoomLevel() <= 3" aria-label="Karte verkleinern">−</button>
        </div>
        @if (!mapLoaded() && !mapError()) { <div class="map-loading" role="status">Karte wird geladen …</div> }
        @if (mapError()) { <div class="map-status-warning" role="status"><span>{{ mapError() }}</span><button type="button" (click)="retryMap()">Karte erneut laden</button></div> }
      </div>
      <p class="map-credit">© <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · Daten: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></p>
      <p class="privacy-note">Deine Koordinaten werden nur auf diesem Gerät gespeichert. OpenFreeMap erhält beim Laden den angezeigten Kartenausschnitt.</p>

      @if (selected(); as item) {
        <section class="preview" aria-live="polite">
          <div class="preview-main">
            @if (imageUrls()[item.id]) { <img [src]="imageUrls()[item.id]" [alt]="'Fundstück: ' + item.identification.name" /> } @else { <div class="image-placeholder" aria-hidden="true">◈</div> }
            <div class="preview-info"><p class="eyebrow">{{ item.findLocation ? (item.findLocation.source === 'gps' ? 'GPS-FUNDORT' : 'MANUELLER FUNDORT') : 'NOCH OHNE FUNDORT' }}</p><h2>{{ item.identification.name }}</h2><p>{{ item.identification.category }} · {{ item.createdAt | date:'d. MMM y, HH:mm' }}</p>@if (item.findLocation) { <p class="coords">{{ item.findLocation.latitude | number:'1.4-4' }}, {{ item.findLocation.longitude | number:'1.4-4' }}</p> }</div>
          </div>
          <div class="actions"><a [routerLink]="['/results', item.id]">Vollständige Analyse ↗</a><button type="button" (click)="beginEdit(item)">{{ item.findLocation ? 'Fundort bearbeiten' : 'Fundort hinzufügen' }}</button>@if (item.findLocation) { <button class="remove" type="button" (click)="removeLocation(item)">Fundort entfernen</button> }</div>
          @if (editing()?.id === item.id) {
            <div class="editor"><h3>Fundort anpassen</h3><app-location-picker [location]="pendingLocation()" (locationChange)="pendingLocation.set($event)"/><div class="editor-actions"><button class="save" type="button" [disabled]="!pendingLocation() || saving()" (click)="saveLocation()">{{ saving() ? 'Wird gespeichert …' : 'Fundort speichern' }}</button><button type="button" (click)="cancelEdit()">Abbrechen</button></div></div>
          }
        </section>
      }

      @if (withoutLocation().length) {
        <section class="unmapped"><div class="section-heading"><div><p class="eyebrow">NACHRÜSTEN</p><h2>Analysen ohne Fundort</h2></div><span>{{ withoutLocation().length }}</span></div><p>Füge älteren Funden nachträglich Koordinaten hinzu.</p><div class="unmapped-list">@for(item of withoutLocation(); track item.id) { <button type="button" (click)="beginEdit(item)"><span>{{ item.identification.name }}</span><span>{{ item.createdAt | date:'d. MMM y' }} · Fundort hinzufügen ↗</span></button> }</div></section>
      }
      @if (!records().length) { <section class="empty"><h2>Noch keine Funde gespeichert</h2><p>Erstelle deine erste Analyse. Den Fundort kannst du optional direkt dort ergänzen.</p><a routerLink="/">Analyse starten ↗</a></section> }
    </section>
  `,
  styles: [`
    :host{display:block}.map-page{max-width:1040px;margin:26px auto 64px;min-width:0}.eyebrow{font-size:16px;letter-spacing:.13em;color:#4b7054;font-weight:700}.heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin:12px 0 22px}.heading h1{font:500 clamp(38px,5vw,54px) Georgia,serif;letter-spacing:-.04em;color:#293b30;margin:0 0 8px}.heading p,.unmapped>p{font-size:16px;color:#52645a;margin:0}.heading>a,.empty>a{background:#315a3a;color:white;text-decoration:none;padding:12px 16px;border-radius:8px;font-size:16px;white-space:nowrap}.map-frame{position:relative;width:100%;min-width:0}.map-view{height:min(62vh,620px);min-height:360px;width:100%;min-width:0;border:1px solid #d9e2d9;border-radius:14px;overflow:hidden;background:#e8efe7}.map-loading{position:absolute;z-index:1000;top:14px;right:14px;padding:8px 12px;border:1px solid #ccd8cc;border-radius:8px;background:#fbfcfa;color:#405746;font-size:16px}.map-credit{font-size:16px;color:#52645a;margin:8px 2px 4px}.map-credit a{color:#315a3a}.privacy-note{font-size:16px;color:#52645a;margin:0 2px 18px;line-height:1.45}.error{font-size:16px;color:#a1342b}.preview,.unmapped,.empty{background:#fbfcfa;border:1px solid #d9e2d9;border-radius:14px;padding:20px;margin:16px 0}.preview-main{display:flex;align-items:center;gap:16px}.preview-main>img,.image-placeholder{width:88px;height:88px;flex:0 0 88px;object-fit:cover;border-radius:9px;background:#e5eee4}.image-placeholder{display:grid;place-items:center;color:#52765a;font-size:32px}.preview-info .eyebrow{margin:0 0 5px;font-size:16px}.preview-info h2,.section-heading h2{font:500 25px Georgia,serif;margin:0 0 5px;color:#293b30}.preview-info p{font-size:16px;color:#52645a;margin:3px 0}.preview-info .coords{font-variant-numeric:tabular-nums}.actions,.editor-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.actions a,.actions button,.editor-actions button{display:inline-flex;align-items:center;min-height:44px;border:1px solid #b6c9b7;border-radius:8px;padding:9px 13px;background:#e5eee4;color:#315a3a;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer}.actions .remove{background:#fffafa;border-color:#e2c5c0;color:#8b3c32}.editor{margin-top:18px;padding-top:18px;border-top:1px solid #d9e2d9}.editor h3{font:500 21px Georgia,serif;margin:0 0 12px;color:#293b30}.editor-actions .save{background:#315a3a;color:white}.editor-actions button:disabled{opacity:.5;cursor:not-allowed}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-heading .eyebrow{margin:0 0 4px}.section-heading>span{background:#e5eee4;border-radius:999px;padding:6px 12px;color:#315a3a;font-size:16px}.unmapped>p{margin:9px 0 14px}.unmapped-list{display:flex;flex-direction:column;gap:8px}.unmapped-list>button{display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left;border:1px solid #d9e2d9;border-radius:8px;padding:12px;background:#fffefa;color:#293b30;cursor:pointer}.unmapped-list>button span{font-size:16px}.unmapped-list>button span+span{color:#52645a}.empty{text-align:center;padding:34px 20px}.empty h2{font:500 24px Georgia,serif}.empty p{font-size:16px;color:#52645a}.empty>a{display:inline-flex;margin-top:8px}
    @media(max-width:650px){.heading{align-items:flex-start;flex-direction:column}.map-view{height:50vh;min-height:320px}.preview{padding:14px}.preview-main{align-items:flex-start}.unmapped-list>button{align-items:flex-start;flex-direction:column;gap:4px}}
    @media(max-width:380px){.map-page{margin-top:16px}.map-view{min-height:280px}.preview-main>img,.image-placeholder{width:68px;height:68px;flex-basis:68px}.actions>*{flex:1 1 100%;justify-content:center}}
  `]
})
export class StoneMapPageComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly repository = inject(AnalysisRepository);
  @ViewChild('mapElement') private mapElement?: ElementRef<HTMLDivElement>;
  readonly records = signal<StoneAnalysis[]>([]);
  readonly located = computed(() => this.records().filter((item) => isFindLocation(item.findLocation)));
  readonly withoutLocation = computed(() => this.records().filter((item) => !isFindLocation(item.findLocation)));
  readonly selected = signal<StoneAnalysis | null>(null);
  readonly editing = signal<StoneAnalysis | null>(null);
  readonly pendingLocation = signal<FindLocation | null>(null);
  readonly imageUrls = signal<Record<string, string>>({});
  readonly saving = signal(false);
  readonly error = signal('');
  readonly mapLoaded = signal(false);
  readonly mapError = signal('');
  readonly zoomLevel = signal(DEFAULT_MAP_ZOOM);
  private map?: MapLibreMap;
  private resizeObserver?: ResizeObserver;
  private viewInitialized = false;
  private imageRequest = 0;

  async ngOnInit(): Promise<void> {
    this.records.set(await this.repository.getAll());
    this.refreshMarkers();
  }

  ngAfterViewInit(): void {
    const element = this.mapElement?.nativeElement;
    if (!element) return;
    this.viewInitialized = true;
    void this.initializeMap(element);
  }

  private async initializeMap(element: HTMLDivElement): Promise<void> {
    try {
      const { Map } = await loadMapLibre();
      if (!this.viewInitialized) return;
      this.map = new Map({
        container: element,
        style: MAP_STYLE_URL,
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
        minZoom: 3,
        maxZoom: 19,
        attributionControl: { compact: false },
        fadeDuration: 0
      });
      this.map.on('load', () => {
        this.mapLoaded.set(true);
        this.mapError.set('');
        this.addFindLayers();
        this.refreshMarkers();
      });
      this.map.on('error', () => this.mapError.set('Die Karte konnte nicht vollständig geladen werden.'));
      this.map.on('zoom', () => this.zoomLevel.set(this.map?.getZoom() ?? DEFAULT_MAP_ZOOM));
      this.resizeObserver = new ResizeObserver(() => invalidateMapSize(this.map!, element));
      this.resizeObserver.observe(element);
      requestAnimationFrame(() => invalidateMapSize(this.map!, element));
    } catch {
      this.mapError.set('Die Karte konnte nicht gestartet werden. Bitte erneut versuchen.');
    }
  }

  private addFindLayers(): void {
    const map = this.map;
    if (!map || map.getSource(SOURCE_ID)) return;
    map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterMaxZoom: 13, clusterRadius: 48 });
    map.addLayer({ id: CLUSTER_LAYER_ID, type: 'circle', source: SOURCE_ID, filter: ['has', 'point_count'], paint: { 'circle-color': '#315a3a', 'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 27], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
    map.addLayer({ id: CLUSTER_COUNT_LAYER_ID, type: 'symbol', source: SOURCE_ID, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 16 }, paint: { 'text-color': '#ffffff' } });
    map.addLayer({ id: POINT_LAYER_ID, type: 'circle', source: SOURCE_ID, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#315a3a', 'circle-radius': 11, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
    map.on('click', CLUSTER_LAYER_ID, (event) => { void this.expandCluster(event); });
    map.on('click', POINT_LAYER_ID, (event) => {
      const id = event.features?.[0]?.properties?.['analysisId'];
      const item = this.records().find((record) => record.id === id);
      if (item) void this.select(item);
    });
    for (const layerId of [CLUSTER_LAYER_ID, POINT_LAYER_ID]) {
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    }
  }

  private async expandCluster(event: import('maplibre-gl').MapLayerMouseEvent): Promise<void> {
    const map = this.map;
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.['cluster_id'];
    const coordinates = feature?.geometry.type === 'Point' ? feature.geometry.coordinates as [number, number] : undefined;
    const source = map?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (clusterId === undefined || !coordinates || !source || !map) return;
    const zoom = await source.getClusterExpansionZoom(Number(clusterId));
    map.easeTo({ center: coordinates, zoom });
  }

  ngOnDestroy(): void {
    this.viewInitialized = false;
    for (const url of Object.values(this.imageUrls())) URL.revokeObjectURL(url);
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = undefined;
  }

  zoomIn(): void { if (this.map) this.map.zoomTo(Math.min(19, this.map.getZoom() + 1)); }
  zoomOut(): void { if (this.map) this.map.zoomTo(Math.max(3, this.map.getZoom() - 1)); }
  retryMap(): void {
    if (!this.map) { const element = this.mapElement?.nativeElement; if (element) void this.initializeMap(element); return; }
    this.mapError.set('');
    this.mapLoaded.set(false);
    this.map.once('style.load', () => { this.mapLoaded.set(true); this.addFindLayers(); this.refreshMarkers(); });
    this.map.setStyle(MAP_STYLE_URL);
  }

  beginEdit(item: StoneAnalysis): void { void this.select(item); this.editing.set(item); this.pendingLocation.set(item.findLocation ?? null); this.error.set(''); }
  cancelEdit(): void { this.editing.set(null); this.pendingLocation.set(null); this.error.set(''); }

  async select(item: StoneAnalysis): Promise<void> {
    this.selected.set(item);
    const request = ++this.imageRequest;
    const image = await this.repository.getImage(item.id);
    if (request !== this.imageRequest) return;
    for (const url of Object.values(this.imageUrls())) URL.revokeObjectURL(url);
    this.imageUrls.set(image ? { [item.id]: URL.createObjectURL(image) } : {});
  }

  async saveLocation(): Promise<void> {
    const item = this.editing();
    const location = this.pendingLocation();
    if (!item || !location || this.saving()) return;
    this.saving.set(true); this.error.set('');
    try {
      const updated = { ...item, findLocation: location };
      await this.repository.save(updated);
      this.replaceRecord(updated);
      this.selected.set(updated);
      this.cancelEdit();
      this.refreshMarkers();
    } catch { this.error.set('Der Fundort konnte nicht gespeichert werden. Bitte versuche es erneut.'); }
    finally { this.saving.set(false); }
  }

  async removeLocation(item: StoneAnalysis): Promise<void> {
    if (!item.findLocation || !window.confirm(`Den Fundort von „${item.identification.name}“ entfernen? Die Analyse und ihr Bild bleiben erhalten.`)) return;
    const { findLocation: _findLocation, ...updated } = item;
    try {
      await this.repository.save(updated);
      this.replaceRecord(updated);
      this.selected.set(updated);
      this.cancelEdit();
      this.refreshMarkers();
    } catch { this.error.set('Der Fundort konnte nicht entfernt werden. Bitte versuche es erneut.'); }
  }

  private replaceRecord(updated: StoneAnalysis): void { this.records.update((records) => records.map((record) => record.id === updated.id ? updated : record)); }

  private refreshMarkers(): void {
    const map = this.map;
    if (!this.viewInitialized || !map || !this.mapLoaded() || !map.getSource(SOURCE_ID)) return;
    const records = this.located();
    const features = records.map((record) => ({ type: 'Feature' as const, id: record.id, geometry: { type: 'Point' as const, coordinates: [record.findLocation!.longitude, record.findLocation!.latitude] as [number, number] }, properties: { analysisId: record.id } }));
    (map.getSource(SOURCE_ID) as GeoJSONSource).setData({ type: 'FeatureCollection', features } satisfies FeatureCollection<Point>);
    if (records.length === 0) map.jumpTo({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM });
    else if (records.length === 1) map.jumpTo({ center: [records[0].findLocation!.longitude, records[0].findLocation!.latitude], zoom: 13 });
    else {
      const longitudes = records.map((record) => record.findLocation!.longitude);
      const latitudes = records.map((record) => record.findLocation!.latitude);
      map.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], { padding: 48, maxZoom: 13, duration: 0 });
    }
  }
}
