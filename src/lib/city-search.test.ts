import { describe, expect, it } from 'vitest';
import { CITIES } from './cities';
import { normalizeSearchText, searchCities } from './city-search';

const ids = (query: string) => searchCities(query, CITIES).map(c => c.id);

describe('normalizeSearchText', () => {
  it('ignores accents, case and extra whitespace', () => {
    expect(normalizeSearchText('  MontRÉAL  ')).toBe('montreal');
    expect(normalizeSearchText('Québec   City')).toBe('quebec city');
  });
});

describe('searchCities', () => {
  it('matches without accents', () => {
    expect(ids('montreal')).toEqual(['montreal-qc']);
    expect(ids('MONTRÉAL')).toEqual(['montreal-qc']);
  });

  it('matches province names', () => {
    expect(ids('alberta')).toEqual(['calgary-ab']);
    expect(ids('quebec')).toEqual(['quebec-qc', 'gatineau-qc', 'laval-qc', 'montreal-qc']);
  });

  it('ranks label-prefix matches before other matches', () => {
    // "to" prefixes Toronto; Winnipeg matches only through its province, "Manitoba".
    expect(ids('to')).toEqual(['toronto-on', 'winnipeg-mb']);
  });

  it('returns every city, alphabetically, for an empty query', () => {
    const all = searchCities('   ', CITIES);
    expect(all).toHaveLength(CITIES.length);
    expect(all[0]?.label).toBe('Calgary');
  });

  it('returns no results for an unmatched query', () => {
    expect(searchCities('zzz', CITIES)).toEqual([]);
  });

  it('handles apostrophes and punctuation in labels', () => {
    expect(ids("st. john's")).toEqual(['st-johns-nl']);
  });
});
