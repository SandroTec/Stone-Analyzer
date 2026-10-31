import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, signal, SimpleChanges, ViewChild } from '@angular/core';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { FindLocation } from '../../models/find-location.model';
import { invalidateMapSize, loadMapLibre, mapLibreCenter, MAP_STYLE_URL } from '../../../features/map/map-config';

@Component({
  selector: 'app-location-map-preview',
  template: `
    <div class="preview-frame">
      <div #mapElement class="preview-map" role="img" aria-label="Karte mit der Markierung des gespeicherten Fundorts"></div>
      @if (!loaded() && !error()) { <span class="map-message" role="status">Karte wird geladen …</span> }
      @if (error()) { <span class="map-message" role="status">Kartenansicht momentan nicht verfügbar</span> }
    </div>
    <p class="attribution">© <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></p>
  `,
  styles: [`
    :host{display:block;min-width:0}.preview-frame{position:relative;min-width:0}.preview-map{width:100%;height:260px;overflow:hidden;border:1px solid #d9e2d9;border-radius:10px;background:#e8efe7}.map-message{position:absolute;top:12px;right:12px;padding:7px 10px;border:1px solid #ccd8cc;border-radius:8px;background:#fbfcfa;color:#405746;font-size:16px}.attribution{margin:5px 0 0;color:#52645a;font-size:16px}.attribution a{color:#315a3a}
  `]
})
export class LocationMapPreviewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) location!: FindLocation;
  @ViewChild('mapElement') private mapElement?: ElementRef<HTMLDivElement>;
  readonly loaded = signal(false);
  readonly error = signal(false);
  private map?: MapLibreMap;
  private marker?: MapLibreMarker;
  private resizeObserver?: ResizeObserver;
  private destroyed = false;

  ngAfterViewInit(): void { void this.initializeMap(); }
  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.map || !this.location) return;
    const center = mapLibreCenter(this.location);
    this.marker?.setLngLat(center);
    this.map.jumpTo({ center, zoom: this.map.getZoom() });
  }
  ngOnDestroy(): void { this.destroyed = true; this.resizeObserver?.disconnect(); this.marker?.remove(); this.map?.remove(); this.map = undefined; }

  private async initializeMap(): Promise<void> {
    const element = this.mapElement?.nativeElement;
    if (!element || !this.location) return;
    try {
      const { Map, Marker } = await loadMapLibre();
      if (this.destroyed) return;
      const center = mapLibreCenter(this.location);
      this.map = new Map({ container: element, style: MAP_STYLE_URL, center, zoom: 12, minZoom: 3, maxZoom: 19, attributionControl: false, interactive: false, fadeDuration: 0 });
      this.marker = new Marker({ color: '#315a3a' }).setLngLat(center).addTo(this.map);
      this.map.on('load', () => this.loaded.set(true));
      this.map.on('error', () => this.error.set(true));
      this.resizeObserver = new ResizeObserver(() => { if (this.map) invalidateMapSize(this.map, element); });
      this.resizeObserver.observe(element);
      requestAnimationFrame(() => { if (this.map) invalidateMapSize(this.map, element); });
    } catch { this.error.set(true); }
  }
}
