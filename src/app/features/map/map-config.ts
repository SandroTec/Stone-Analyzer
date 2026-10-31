import type { Map as MapLibreMap } from 'maplibre-gl';

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';
// MapLibre expects [longitude, latitude]; this is the geographic center of Germany.
export const DEFAULT_MAP_CENTER: [number, number] = [10.4515, 51.1657];
export const DEFAULT_MAP_ZOOM = 6;

export async function loadMapLibre(): Promise<typeof import('maplibre-gl')> {
  const maplibre = await import('maplibre-gl');
  maplibre.setWorkerUrl(new URL('assets/maplibre-gl-worker.mjs', document.baseURI).toString());
  return maplibre;
}

export function mapLibreCenter(location: { latitude: number; longitude: number }): [number, number] {
  return [location.longitude, location.latitude];
}

export function invalidateMapSize(map: MapLibreMap, element: HTMLElement): void {
  if (element.clientWidth > 0 && element.clientHeight > 0) map.resize();
}
