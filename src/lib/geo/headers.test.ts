import { describe, expect, it } from 'vitest';
import { CITIES, getCityById, type City } from '@/lib/cities';
import { defaultCityForHeaders, readApproximatePosition } from './headers';
import { haversineKm, nearestCatalogueCity } from './nearest-city';

// Synthetic coordinates only. No real visitor data is used in tests.
const LAVAL = getCityById('laval-qc') as City;

function headersWith(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(45.5, -73.6, 45.5, -73.6)).toBeCloseTo(0, 6);
  });

  it('is about 541 km between Montréal and Toronto', () => {
    const km = haversineKm(45.5017, -73.5673, 43.6532, -79.3832);
    expect(km).toBeGreaterThan(500);
    expect(km).toBeLessThan(560);
  });
});

describe('nearestCatalogueCity', () => {
  it('picks the closest catalogue city', () => {
    expect(nearestCatalogueCity(45.6, -73.7, 300)?.id).toBe('laval-qc');
    expect(nearestCatalogueCity(46.8, -71.2, 300)?.id).toBe('quebec-qc');
  });

  it('returns undefined when no city is within the limit', () => {
    // Synthetic point in the Arctic Ocean, far from every catalogue city.
    expect(nearestCatalogueCity(85, 0, 300)).toBeUndefined();
  });

  it('respects the distance boundary', () => {
    // Exactly on Montréal's centre: distance 0 is accepted with a zero limit.
    expect(nearestCatalogueCity(45.5017, -73.5673, 0)?.id).toBe('montreal-qc');
    // About 11 km north of Montréal's centre: a zero limit rejects it.
    expect(nearestCatalogueCity(45.6, -73.5673, 0)).toBeUndefined();
    const km = haversineKm(45.5017, -73.5673, 45.6, -73.5673);
    expect(nearestCatalogueCity(45.6, -73.5673, km + 0.01)).toBeDefined();
  });

  it('works on a custom list', () => {
    const only: City[] = [{ ...LAVAL, id: 'test-only' }];
    expect(nearestCatalogueCity(45.6, -73.7, 300, only)?.id).toBe('test-only');
  });
});

describe('readApproximatePosition', () => {
  it('reads valid latitude and longitude', () => {
    expect(readApproximatePosition(headersWith({
      'x-vercel-ip-latitude': '45.50',
      'x-vercel-ip-longitude': '-73.57',
    }))).toEqual({ latitude: 45.5, longitude: -73.57 });
  });

  it('returns undefined when a header is missing', () => {
    expect(readApproximatePosition(headersWith({ 'x-vercel-ip-latitude': '45.5' }))).toBeUndefined();
    expect(readApproximatePosition(new Headers())).toBeUndefined();
  });

  it('rejects malformed and out-of-range values', () => {
    const cases: [string, string][] = [
      ['abc', '-73.5'],
      ['45.5', 'NaN'],
      ['1e3', '-73.5'],
      ['91', '0'],
      ['0', '181'],
      ['', ''],
      ['45.5; drop', '-73.5'],
    ];
    for (const [latitude, longitude] of cases) {
      expect(readApproximatePosition(headersWith({
        'x-vercel-ip-latitude': latitude,
        'x-vercel-ip-longitude': longitude,
      }))).toBeUndefined();
    }
  });
});

describe('defaultCityForHeaders', () => {
  it('uses the nearest catalogue city when the position is known', () => {
    const city = defaultCityForHeaders(headersWith({
      'x-vercel-ip-latitude': '49.25',
      'x-vercel-ip-longitude': '-123.12',
    }), LAVAL);
    expect(city.id).toBe('vancouver-bc');
  });

  it('falls back to Laval without headers, as in local development', () => {
    expect(defaultCityForHeaders(new Headers(), LAVAL).id).toBe('laval-qc');
  });

  it('falls back to Laval for a far-away position', () => {
    expect(defaultCityForHeaders(headersWith({
      'x-vercel-ip-latitude': '-33.87',
      'x-vercel-ip-longitude': '151.21',
    }), LAVAL)).toBe(LAVAL);
  });

  it('only ever returns a catalogue city', () => {
    const city = defaultCityForHeaders(headersWith({
      'x-vercel-ip-latitude': '45.5',
      'x-vercel-ip-longitude': '-73.6',
      'x-vercel-ip-city': 'Synthetic%20Town',
    }), LAVAL);
    expect(CITIES).toContain(city);
  });
});
