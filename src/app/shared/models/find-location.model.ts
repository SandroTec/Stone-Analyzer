export type FindLocationSource = 'gps' | 'manual';

export interface FindLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  source: FindLocationSource;
  updatedAt: string;
}

export function isFindLocation(value: unknown): value is FindLocation {
  if (typeof value !== 'object' || value === null) return false;
  const location = value as Partial<FindLocation>;
  return typeof location.latitude === 'number'
    && Number.isFinite(location.latitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && typeof location.longitude === 'number'
    && Number.isFinite(location.longitude)
    && location.longitude >= -180
    && location.longitude <= 180
    && (location.accuracyMeters === undefined || (typeof location.accuracyMeters === 'number' && Number.isFinite(location.accuracyMeters) && location.accuracyMeters >= 0))
    && (location.source === 'gps' || location.source === 'manual')
    && typeof location.updatedAt === 'string'
    && !Number.isNaN(Date.parse(location.updatedAt));
}
