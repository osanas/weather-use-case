import { type City } from '@/lib/cities';
import { nearestCatalogueCity } from './nearest-city';

/** Largest distance, in kilometres, at which a visitor's approximate position still picks a city. */
export const MAX_DEFAULT_CITY_KM = 300;

const NUMBER = /^-?\d{1,3}(\.\d{1,6})?$/;

/**
 * Reads the host-provided approximate position (Vercel adds these to function requests).
 * Only latitude and longitude are read. The city name, country, IP and every other header
 * are ignored, and nothing is logged. Anything malformed or out of range yields `undefined`.
 */
export function readApproximatePosition(headers: Headers): { latitude: number; longitude: number } | undefined {
  const rawLat = headers.get('x-vercel-ip-latitude')?.trim() ?? '';
  const rawLon = headers.get('x-vercel-ip-longitude')?.trim() ?? '';
  if (!NUMBER.test(rawLat) || !NUMBER.test(rawLon)) return undefined;
  const latitude = Number(rawLat);
  const longitude = Number(rawLon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

/**
 * The default city for a request: the nearest catalogue city, or `fallback` when unknown or far away.
 * `located` is true only when the city was chosen from the approximate position.
 */
export function locateDefaultCity(
  headers: Headers,
  fallback: City,
  cities?: readonly City[],
): { city: City; located: boolean } {
  const position = readApproximatePosition(headers);
  if (!position) return { city: fallback, located: false };
  const city = nearestCatalogueCity(position.latitude, position.longitude, MAX_DEFAULT_CITY_KM, cities);
  return city ? { city, located: true } : { city: fallback, located: false };
}

export function defaultCityForHeaders(headers: Headers, fallback: City, cities?: readonly City[]): City {
  return locateDefaultCity(headers, fallback, cities).city;
}
