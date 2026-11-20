import { provinceName, type City } from './cities';

/** Lowercases, trims and strips accents so "montreal" matches "Montréal". */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Local, in-browser city search. Ranks label-prefix matches first, then other
 * label or province matches, then alphabetically. An empty query returns every city.
 */
export function searchCities(query: string, cities: readonly City[]): City[] {
  const q = normalizeSearchText(query);
  const byLabel = (a: City, b: City) => a.label.localeCompare(b.label, 'en-CA');
  if (!q) return [...cities].sort(byLabel);

  const ranked: { city: City; rank: number }[] = [];
  for (const city of cities) {
    const label = normalizeSearchText(city.label);
    const province = normalizeSearchText(provinceName(city));
    if (label.startsWith(q)) ranked.push({ city, rank: 0 });
    else if (label.includes(q) || province.includes(q)) ranked.push({ city, rank: 1 });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || byLabel(a.city, b.city))
    .map(entry => entry.city);
}
