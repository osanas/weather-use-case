import { describe, expect, it } from 'vitest';
import { buildCatalogue, decodeCatalogue, parseGeoRow } from './catalogue-build';
import { CATALOGUE, findCity } from './catalogue';
import { CITIES, cityDisplayName, isCityIdFormat } from './cities';
import { searchCities } from './city-search';

// Synthetic GeoNames rows (19 tab-separated fields).
const row = (id: string, name: string, country: string, admin1: string, pop: number, tz: string, lat = 45, lon = -73) =>
  [id, name, name, '', String(lat), String(lon), 'P', 'PPL', country, '', admin1, '', '', '', String(pop), '', '', tz, '2026-01-01'].join('\t');

describe('parseGeoRow', () => {
  it('keeps Canadian and US rows with postal region codes', () => {
    expect(parseGeoRow(row('6077243', 'Montréal', 'CA', '10', 1600000, 'America/Toronto'))).toMatchObject({
      geonameId: '6077243', name: 'Montréal', country: 'CA', region: 'QC', population: 1600000, timeZone: 'America/Toronto',
    });
    expect(parseGeoRow(row('4250542', 'Springfield', 'US', 'IL', 114000, 'America/Chicago'))?.region).toBe('IL');
  });

  it('drops other countries and malformed rows', () => {
    expect(parseGeoRow(row('1', 'Paris', 'FR', '11', 2000000, 'Europe/Paris'))).toBeNull();
    expect(parseGeoRow(row('x1', 'Bad', 'US', 'IL', 1, 'America/Chicago'))).toBeNull();
    expect(parseGeoRow(row('2', 'Nowhere', 'CA', '99', 1, 'America/Toronto'))).toBeNull();
    expect(parseGeoRow('too\tfew')).toBeNull();
  });
});

describe('buildCatalogue', () => {
  const rows = [
    row('1', 'Laval', 'CA', '10', 438000, 'America/Toronto'),
    row('2', 'Laval', 'CA', '10', 900, 'America/Toronto'),
    row('3', 'Springfield', 'US', 'IL', 114000, 'America/Chicago'),
  ].map(line => parseGeoRow(line)!);
  const laval = CITIES.find(c => c.id === 'laval-qc')!;

  it('keeps curated IDs and labels, gives others gn- IDs, and sorts by population', () => {
    const file = buildCatalogue(rows, [laval]);
    expect(file.cities.map(c => c[0])).toEqual(['laval-qc', 'gn-3', 'gn-2']);
    const decoded = decodeCatalogue(file);
    expect(decoded[0]).toMatchObject({ id: 'laval-qc', label: 'Laval', latitude: laval.latitude, timeZone: 'America/Toronto' });
    expect(decoded[1]).toMatchObject({ id: 'gn-3', country: 'US', province: 'IL', timeZone: 'America/Chicago' });
  });

  it('fails when a curated city is missing', () => {
    expect(() => buildCatalogue(rows.slice(2), [laval])).toThrow('laval-qc');
  });
});

describe('the committed catalogue', () => {
  it('covers Canada and the United States and keeps every curated city', () => {
    expect(CATALOGUE.length).toBeGreaterThan(8000);
    for (const city of CITIES) expect(findCity(city.id)).toMatchObject({ id: city.id, label: city.label, timeZone: city.timeZone });
    expect(new Set(CATALOGUE.map(c => c.id)).size).toBe(CATALOGUE.length);
    expect(CATALOGUE.every(c => isCityIdFormat(c.id))).toBe(true);
  });

  it('resolves gn- IDs and rejects anything else', () => {
    const springfield = searchCities('springfield, il', CATALOGUE, 1)[0]!;
    expect(springfield.id).toMatch(/^gn-\d+$/);
    expect(cityDisplayName(springfield)).toBe('Springfield, Illinois');
    expect(findCity(springfield.id)).toBe(springfield);
    for (const id of ['gn-0', 'gn-', 'gn-12a', 'GN-1', 'atlantis-qc', 'laval-qc ', 42, null, '../laval-qc']) {
      expect(findCity(id)).toBeUndefined();
    }
  });
});

describe('searchCities on the full catalogue', () => {
  const top = (q: string, n = 3) => searchCities(q, CATALOGUE, n).map(c => cityDisplayName(c));

  it('ranks prefix matches by population and caps the results', () => {
    expect(top('springf', 8)).toHaveLength(8);
    expect(top('springf', 1)).toEqual(['Springfield, Missouri']);
    expect(top('montr', 1)).toEqual(['Montréal, Québec']);
    expect(top('quebec', 1)).toEqual(['Québec City, Québec']);
  });

  it('filters by province or state after a comma, by code or name, and matches "name region"', () => {
    expect(top('springfield, ma', 1)).toEqual(['Springfield, Massachusetts']);
    expect(top('springfield, oreg', 1)).toEqual(['Springfield, Oregon']);
    expect(top('portland maine', 1)).toEqual(['Portland, Maine']);
    expect(top('saint-jean, qc', 3).every(n => n.endsWith('Québec'))).toBe(true);
  });
});
