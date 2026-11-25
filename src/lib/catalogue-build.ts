/**
 * Turns the GeoNames `cities5000` dump into the app's compact North American catalogue
 * (WEA-23). Pure, so it is unit-tested on synthetic rows; `scripts/build-cities.ts` runs it on
 * a dump downloaded once by the maintainer. GeoNames data is CC BY 4.0 (attribution in the UI).
 */
import type { City } from './cities';

/** Canadian GeoNames admin1 codes to postal abbreviations. US admin1 codes are already postal. */
export const CA_ADMIN1: Readonly<Record<string, string>> = {
  '01': 'AB', '02': 'BC', '03': 'MB', '04': 'NB', '05': 'NL', '07': 'NS',
  '08': 'ON', '09': 'PE', '10': 'QC', '11': 'SK', '12': 'YT', '13': 'NT', '14': 'NU',
};

export type GeoRow = {
  geonameId: string;
  name: string;
  latitude: number;
  longitude: number;
  country: 'CA' | 'US';
  region: string;
  population: number;
  timeZone: string;
};

/** Parses one tab-separated GeoNames line; `null` for other countries or malformed rows. */
export function parseGeoRow(line: string): GeoRow | null {
  const f = line.split('\t');
  if (f.length < 19) return null;
  const country = f[8];
  if (country !== 'CA' && country !== 'US') return null;
  const region = country === 'CA' ? CA_ADMIN1[f[10] ?? ''] : f[10];
  const latitude = Number(f[4]);
  const longitude = Number(f[5]);
  const population = Number(f[14]);
  const name = (f[1] ?? '').trim();
  const timeZone = (f[17] ?? '').trim();
  if (!/^\d{1,10}$/.test(f[0] ?? '') || !name || !region || !/^[A-Z]{2}$/.test(region)) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !timeZone.includes('/')) return null;
  return {
    geonameId: f[0]!, name, latitude, longitude, country, region,
    population: Number.isFinite(population) ? population : 0, timeZone,
  };
}

/** Compact catalogue file: zones are shared to keep the download small. */
export type CatalogueFile = {
  v: 1;
  source: string;
  zones: string[];
  /** [id, name, region, country, latitude, longitude, zone index, population] */
  cities: [string, string, string, 'CA' | 'US', number, number, number, number][];
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Builds the catalogue. Each curated city keeps its ID, label and coordinates and replaces
 * the most populous GeoNames row of the same name in its province, so existing links and
 * tests stay stable. Throws when a curated city has no match.
 */
export function buildCatalogue(rows: readonly GeoRow[], curated: readonly City[], aliases: Readonly<Record<string, string>> = {}): CatalogueFile {
  const zones: string[] = [];
  const zoneIndex = (tz: string) => {
    let i = zones.indexOf(tz);
    if (i === -1) i = zones.push(tz) - 1;
    return i;
  };
  const replaced = new Map<string, City>();
  for (const city of curated) {
    const wanted = norm(aliases[city.id] ?? city.label);
    const match = rows
      .filter(r => r.region === city.province && norm(r.name) === wanted)
      .sort((a, b) => b.population - a.population)[0];
    if (!match) throw new Error(`No GeoNames row for curated city ${city.id}`);
    replaced.set(match.geonameId, city);
  }
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  const cities: CatalogueFile['cities'] = rows
    .slice()
    .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name, 'en'))
    .map(r => {
      const c = replaced.get(r.geonameId);
      return c
        ? [c.id, c.label, c.province, r.country, c.latitude, c.longitude, zoneIndex(c.timeZone), r.population]
        : [`gn-${r.geonameId}`, r.name, r.region, r.country, round(r.latitude), round(r.longitude), zoneIndex(r.timeZone), r.population];
    });
  return { v: 1, source: 'GeoNames cities5000, CC BY 4.0, https://www.geonames.org/', zones, cities };
}

/** Decodes the compact file into cities (used by the server and the browser). */
export function decodeCatalogue(file: CatalogueFile): City[] {
  return file.cities.map(([id, label, province, country, latitude, longitude, zone, population]) => ({
    id, label, province, country, latitude, longitude, timeZone: file.zones[zone] ?? 'UTC', population,
  }));
}
