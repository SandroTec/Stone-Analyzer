import { DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, signal, SimpleChanges, ViewChild } from '@angular/core';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { FindLocation } from '../../models/find-location.model';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, invalidateMapSize, loadMapLibre, MAP_STYLE_URL, mapLibreCenter } from '../../../features/map/map-config';

@Component({
  selector: 'app-location-picker',
  imports: [DecimalPipe],
  template: `
    <div class="picker-tools">
      <button type="button" class="gps" (click)="useCurrentLocation()" [disabled]="locating()">{{ locating() ? 'Standort wird ermittelt …' : 'Aktuellen Standort verwenden' }}</button>
      <span class="instruction">oder Fundort direkt auf der Karte anklicken</span>
    </div>
    @if (location) {
      <p class="coordinates">{{ location.latitude | number:'1.5-5' }}, {{ location.longitude | number:'1.5-5' }} · {{ location.source === 'gps' ? 'GPS' : 'Karte' }}@if (location.accuracyMeters !== undefined) { · Genauigkeit ca. {{ Math.round(location.accuracyMeters) }} m }</p>
      @if (location.source === 'gps' && (location.accuracyMeters ?? 0) > 250) { <p class="warning" role="status">Der GPS-Standort ist ungenau. Verschiebe den Marker bei Bedarf auf der Karte.</p> }
    }
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <div class="map-frame">
      <div #mapElement class="map" role="application" aria-label="Karte zur Auswahl des Fundorts"></div>
      <div class="map-zoom-controls" role="group" aria-label="Kartenzoom">
        <button type="button" (click)="zoomIn()" aria-label="Karte vergrößern">+</button>
        <button type="button" (click)="zoomOut()" aria-label="Karte verkleinern">−</button>
      </div>
      @if (!mapLoaded() && !mapError()) { <div class="map-loading" role="status">Karte wird geladen …</div> }
      @if (mapError()) {
        <div class="map-status-warning" role="status"><span>{{ mapError() }}</span><button type="button" (click)="retryMap()">Karte erneut laden</button></div>
      }
    </div>
    <p class="privacy">Deine Koordinaten bleiben auf diesem Gerät. OpenFreeMap erhält beim Laden den angezeigten Kartenausschnitt.</p>
    @if (location) { <button type="button" class="clear" (click)="clearLocation()">Fundort entfernen</button> }
  `,
  styles: [`
    :host{display:block;min-width:0}.picker-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.gps,.clear{min-height:44px;border:1px solid #9db29f;border-radius:8px;background:#e5eee4;color:#315a3a;padding:10px 14px;font-size:16px;font-weight:600;cursor:pointer}.gps:disabled{opacity:.6;cursor:wait}.instruction,.coordinates,.warning,.error,.privacy{font-size:16px}.instruction,.coordinates,.privacy{color:#52645a}.coordinates{margin:12px 0 6px;overflow-wrap:anywhere}.privacy{margin:8px 0 0;line-height:1.4}.warning{margin:6px 0;color:#815c1b}.error{margin:8px 0;color:#a1342b}.map-frame{position:relative;width:100%;min-width:0}.map{height:260px;width:100%;min-width:0;border:1px solid #ccd8cc;border-radius:10px;overflow:hidden;background:#e8efe7}.map-loading{position:absolute;z-index:1000;top:14px;right:14px;padding:8px 12px;border:1px solid #ccd8cc;border-radius:8px;background:#fbfcfa;color:#405746;font-size:16px}.clear{margin-top:10px;background:#fffefa;color:#8b3c32;border-color:#e2c5c0}@media(max-width:540px){.picker-tools{align-items:stretch;flex-direction:column;gap:8px}.gps{width:100%}.map{height:230px}}
  `]
})
export class LocationPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() location: FindLocation | null = null;
  @Output() locationChange = new EventEmitter<FindLocation | null>();
  @ViewChild('mapElement') private mapElement?: ElementRef<HTMLDivElement>;
  readonly Math = Math;
  readonly locating = signal(false);
  readonly error = signal('');
  readonly mapLoaded = signal(false);
  readonly mapError = signal('');
  private map?: MapLibreMap;
  private marker?: MapLibreMarker;
  private resizeObserver?: ResizeObserver;
  private destroyed = false;

  ngAfterViewInit(): void { void this.initializeMap(); }

  private async initializeMap(): Promise<void> {
    const element = this.mapElement?.nativeElement;
    if (!element) return;
    try {
      const { Map, Marker } = await loadMapLibre();
      if (this.destroyed) return;
      this.map = new Map({
        container: element,
        style: MAP_STYLE_URL,
        center: this.location ? mapLibreCenter(this.location) : DEFAULT_MAP_CENTER,
        zoom: this.location ? 13 : DEFAULT_MAP_ZOOM,
        minZoom: 3,
        maxZoom: 19,
        attributionControl: { compact: false },
        fadeDuration: 0
      });
      this.map.on('load', () => this.onMapLoaded());
      this.map.on('error', () => this.mapError.set('Die Karte konnte nicht vollständig geladen werden.'));
      this.map.on('click', (event) => this.setManualLocation(event.lngLat.lat, event.lngLat.lng));
      this.resizeObserver = new ResizeObserver(() => invalidateMapSize(this.map!, element));
      this.resizeObserver.observe(element);
      requestAnimationFrame(() => invalidateMapSize(this.map!, element));
      this.marker = new Marker({ draggable: true, color: '#315a3a' });
      this.marker.on('dragend', () => {
        const point = this.marker?.getLngLat();
        if (point) this.setManualLocation(point.lat, point.lng);
      });
      this.syncMarker();
    } catch {
      this.mapError.set('Die Karte konnte nicht gestartet werden. Bitte erneut versuchen.');
    }
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.map) return;
    this.syncMarker();
    if (this.location) this.map.jumpTo({ center: mapLibreCenter(this.location), zoom: Math.max(this.map.getZoom(), 13) });
  }

  ngOnDestroy(): void { this.destroyed = true; this.resizeObserver?.disconnect(); this.marker?.remove(); this.map?.remove(); this.map = undefined; }

  zoomIn(): void { if (this.map) this.map.zoomTo(Math.min(19, this.map.getZoom() + 1)); }
  zoomOut(): void { if (this.map) this.map.zoomTo(Math.max(3, this.map.getZoom() - 1)); }
  retryMap(): void {
    if (!this.map) { void this.initializeMap(); return; }
    this.mapError.set('');
    this.mapLoaded.set(false);
    this.map.once('style.load', () => this.onMapLoaded());
    this.map.setStyle(MAP_STYLE_URL);
  }

  useCurrentLocation(): void {
    this.error.set('');
    if (!navigator.geolocation) { this.error.set('Dein Browser unterstützt keine Standortermittlung. Wähle den Fundort auf der Karte.'); return; }
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.locating.set(false);
        this.location = { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy, source: 'gps', updatedAt: new Date().toISOString() };
        this.syncMarker();
        this.map?.flyTo({ center: mapLibreCenter(this.location), zoom: 15 });
        this.locationChange.emit(this.location);
      },
      (failure) => {
        this.locating.set(false);
        this.error.set(failure.code === failure.PERMISSION_DENIED
          ? 'Standortfreigabe verweigert. Du kannst den Fundort weiterhin auf der Karte auswählen.'
          : failure.code === failure.TIMEOUT
            ? 'Die Standortermittlung hat zu lange gedauert. Wähle den Fundort auf der Karte oder versuche es erneut.'
            : 'Der aktuelle Standort konnte nicht ermittelt werden. Wähle den Fundort auf der Karte.');
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );
  }

  clearLocation(): void { this.location = null; this.marker?.remove(); this.error.set(''); this.locationChange.emit(null); }

  private onMapLoaded(): void { this.mapLoaded.set(true); this.mapError.set(''); this.syncMarker(); }
  private setManualLocation(latitude: number, longitude: number): void {
    this.error.set('');
    this.location = { latitude, longitude, source: 'manual', updatedAt: new Date().toISOString() };
    this.syncMarker();
    this.locationChange.emit(this.location);
  }

  private syncMarker(): void {
    if (!this.map || !this.marker) return;
    if (!this.location) { this.marker.remove(); return; }
    this.marker.setLngLat(mapLibreCenter(this.location)).addTo(this.map);
  }
}
