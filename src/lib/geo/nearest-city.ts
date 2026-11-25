import { CITIES, type City } from '@/lib/cities';

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The catalogue city closest to a point, or `undefined` when none lies within `maxKm`.
 * Only the catalogue ID is ever returned; the coordinates are not stored or forwarded.
 */
export function nearestCatalogueCity(
  latitude: number,
  longitude: number,
  maxKm: number,
  cities: readonly City[] = CITIES,
): City | undefined {
  let best: City | undefined;
  let bestKm = Infinity;
  // Cheap bounding box first (1° of latitude is about 111 km), then the exact distance.
  const latSpan = maxKm / 111 + 0.5;
  for (const city of cities) {
    if (Math.abs(city.latitude - latitude) > latSpan) continue;
    const km = haversineKm(latitude, longitude, city.latitude, city.longitude);
    if (km < bestKm) {
      best = city;
      bestKm = km;
    }
  }
  return best && bestKm <= maxKm ? best : undefined;
}
