import { provinceName, type City } from './cities';

/** Lowercases, trims and strips accents so "montreal" matches "Montréal". */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

type Keys = { label: string; region: string; code: string };
const keys = new WeakMap<City, Keys>();
function keysFor(city: City): Keys {
  let k = keys.get(city);
  if (!k) {
    k = { label: normalizeSearchText(city.label), region: normalizeSearchText(provinceName(city)), code: city.province.toLowerCase() };
    keys.set(city, k);
  }
  return k;
}

/** Larger cities first, then alphabetically. */
const byPopulationThenLabel = (a: City, b: City) =>
  (b.population ?? 0) - (a.population ?? 0) || a.label.localeCompare(b.label, 'en-CA');

/**
 * Local, in-browser city search; the query never leaves the browser.
 * - "spring" ranks names that start with it first, then "springfield illinois"-style matches on
 *   name and region, then names that contain it; larger cities first within each rank.
 * - "springfield, il" or "springfield, illinois" keeps only that province or state.
 * An empty query returns every city alphabetically. `limit` caps the results.
 */
export function searchCities(query: string, cities: readonly City[], limit = Infinity): City[] {
  const q = normalizeSearchText(query);
  if (!q) return [...cities].sort((a, b) => a.label.localeCompare(b.label, 'en-CA')).slice(0, limit);

  const comma = q.indexOf(',');
  const name = comma === -1 ? q : q.slice(0, comma).trim();
  const region = comma === -1 ? '' : q.slice(comma + 1).trim();

  const ranked: { city: City; rank: number }[] = [];
  for (const city of cities) {
    const k = keysFor(city);
    if (region && !(k.code === region || k.region.startsWith(region))) continue;
    if (k.label.startsWith(name)) ranked.push({ city, rank: 0 });
    else if (!region && `${k.label} ${k.region}`.startsWith(q)) ranked.push({ city, rank: 1 });
    else if (k.label.includes(name) || (!region && k.region.includes(q))) ranked.push({ city, rank: 2 });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || byPopulationThenLabel(a.city, b.city))
    .slice(0, limit)
    .map(entry => entry.city);
}
