import { describe, expect, it } from 'vitest';
import { CITIES, cityDisplayName, getCityById } from './cities';

describe('city catalogue', () => {
  it('has unique kebab-case IDs', () => {
    const ids = CITIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('uses valid IANA time zones', () => {
    for (const city of CITIES) {
      expect(() => new Intl.DateTimeFormat('en-CA', { timeZone: city.timeZone })).not.toThrow();
    }
  });

  it('keeps coordinates inside Canada', () => {
    for (const city of CITIES) {
      expect(city.latitude).toBeGreaterThan(41.6);
      expect(city.latitude).toBeLessThan(83.2);
      expect(city.longitude).toBeGreaterThan(-141.1);
      expect(city.longitude).toBeLessThan(-52.6);
    }
  });

  it('includes Laval, Montréal and cities in other time zones', () => {
    expect(getCityById('laval-qc')?.timeZone).toBe('America/Toronto');
    expect(getCityById('montreal-qc')?.timeZone).toBe('America/Toronto');
    expect(new Set(CITIES.map(c => c.timeZone)).size).toBeGreaterThanOrEqual(3);
  });

  it('labels cities with their province', () => {
    expect(cityDisplayName(getCityById('laval-qc')!)).toBe('Laval, Québec');
    expect(cityDisplayName(getCityById('st-johns-nl')!)).toBe("St. John's, Newfoundland and Labrador");
  });
});

describe('getCityById', () => {
  it.each([undefined, null, 42, '', 'unknown', 'LAVAL-QC', ' laval-qc', 'laval-qc '])(
    'rejects %j',
    id => {
      expect(getCityById(id)).toBeUndefined();
    },
  );
});
