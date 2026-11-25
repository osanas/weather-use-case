import { describe, expect, it } from 'vitest';
import { describeWeatherCode, UNAVAILABLE } from '@/lib/format';
import { DROP, ICONS, ICON_SIZE, WIND, iconForCode, type IconKind } from './icons';
import { gridMarkup, gridRuns, gridWidth } from './pixels';

describe('iconForCode', () => {
  it('gives every code the app can describe a weather icon', () => {
    for (let code = 0; code <= 99; code++) {
      const known = describeWeatherCode(code) !== UNAVAILABLE;
      expect(iconForCode(code) !== 'unknown', `code ${code}`).toBe(known);
    }
  });

  it.each<[number, IconKind]>([
    [0, 'clear'], [1, 'clear'],
    [2, 'partly-cloudy'],
    [3, 'overcast'],
    [45, 'fog'], [48, 'fog'],
    [51, 'drizzle'], [55, 'drizzle'],
    [56, 'freezing'], [57, 'freezing'], [66, 'freezing'], [67, 'freezing'],
    [61, 'rain'], [65, 'rain'],
    [80, 'showers'], [82, 'showers'],
    [71, 'snow'], [77, 'snow'],
    [85, 'snow-showers'], [86, 'snow-showers'],
    [95, 'thunderstorm'],
    [96, 'hail'], [99, 'hail'],
  ])('maps WMO code %i to %s', (code, kind) => {
    expect(iconForCode(code)).toBe(kind);
  });

  it('uses the unknown icon for missing or unrecognised codes', () => {
    expect(iconForCode(null)).toBe('unknown');
    expect(iconForCode(4)).toBe('unknown');
    expect(iconForCode(-1)).toBe('unknown');
    expect(iconForCode(100)).toBe('unknown');
  });
});

describe('ICONS', () => {
  it.each(Object.entries(ICONS))('%s is a non-empty 16×16 grid with valid classes', (_kind, grid) => {
    expect(grid).toHaveLength(ICON_SIZE);
    expect(gridWidth(grid)).toBe(ICON_SIZE);
    expect(gridRuns(grid).length).toBeGreaterThan(0);
    expect(() => gridMarkup(grid)).not.toThrow();
    expect(gridRuns(grid).every(run => run.cls.startsWith('icon-'))).toBe(true);
  });

  it('draws a distinct picture for every icon group', () => {
    const pictures = new Set(Object.values(ICONS).map(gridMarkup));
    expect(pictures.size).toBe(Object.keys(ICONS).length);
  });

  it('has valid glyphs for precipitation and wind', () => {
    expect(() => gridMarkup(DROP)).not.toThrow();
    expect(() => gridMarkup(WIND)).not.toThrow();
  });
});
