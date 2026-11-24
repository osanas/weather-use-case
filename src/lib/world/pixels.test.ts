import { describe, expect, it } from 'vitest';
import {
  createGrid, fillDisc, fillRect, gridMarkup, gridRuns, line, parseArt, plot, seededRandom, stamp,
} from './pixels';
import { columnTop, GROUND_Y, skyline, SKYLINE_HEIGHT, SKYLINE_WIDTH } from './skyline';
import { CLOUD_LARGE, MOON, STARS, STAR_FIELD, SUN } from './sprites';

describe('gridRuns', () => {
  it('merges consecutive same-class pixels per row and skips transparent ones', () => {
    const grid = parseArt(['aab.a', '..bbb'], { a: 'roof', b: 'win' });
    expect(gridRuns(grid)).toEqual([
      { x: 0, y: 0, w: 2, cls: 'roof' },
      { x: 2, y: 0, w: 1, cls: 'win' },
      { x: 4, y: 0, w: 1, cls: 'roof' },
      { x: 2, y: 1, w: 3, cls: 'win' },
    ]);
  });

  it('returns no runs for an empty grid', () => {
    expect(gridRuns(createGrid(4, 3))).toEqual([]);
  });
});

describe('parseArt', () => {
  it('rejects unknown characters and ragged rows', () => {
    expect(() => parseArt(['ax'], { a: 'roof' })).toThrow(/Unknown art character "x"/);
    expect(() => parseArt(['aa', 'a'], { a: 'roof' })).toThrow(/row 1/);
    expect(() => parseArt([''], {})).toThrow(RangeError);
  });
});

describe('drawing helpers', () => {
  it('clips everything outside the grid', () => {
    const grid = createGrid(3, 2);
    plot(grid, -1, 0, 'a');
    plot(grid, 3, 0, 'a');
    plot(grid, 0, 5, 'a');
    fillRect(grid, 2, 1, 5, 5, 'b');
    expect(grid).toEqual([[null, null, null], [null, null, 'b']]);
  });

  it('draws a symmetric disc', () => {
    const grid = createGrid(9, 9);
    fillDisc(grid, 4, 4, 3, 'd');
    for (let y = 0; y < 9; y++) expect(grid[y]).toEqual([...grid[y]!].reverse());
    expect(grid[4]![1]).toBe('d');
    expect(grid[4]![0]).toBeNull();
  });

  it('draws lines including both end points', () => {
    const grid = createGrid(5, 5);
    line(grid, 0, 0, 4, 4, 'l');
    expect([0, 1, 2, 3, 4].every(i => grid[i]![i] === 'l')).toBe(true);
  });

  it('stamps only opaque pixels', () => {
    const grid = createGrid(3, 1);
    fillRect(grid, 0, 0, 3, 1, 'bg');
    stamp(grid, parseArt(['.x.'], { x: 'fg' }), 0, 0);
    expect(grid[0]).toEqual(['bg', 'fg', 'bg']);
  });

  it('rejects invalid grid sizes', () => {
    expect(() => createGrid(0, 2)).toThrow(RangeError);
    expect(() => createGrid(2.5, 2)).toThrow(RangeError);
  });
});

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed, within [0, 1)', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const values = Array.from({ length: 50 }, () => a());
    expect(values).toEqual(Array.from({ length: 50 }, () => b()));
    expect(values.every(v => v >= 0 && v < 1)).toBe(true);
  });
});

describe('skyline', () => {
  const { far, mid, near } = skyline();

  it('builds every layer at the art size and is stable between calls', () => {
    for (const layer of [far, mid, near]) {
      for (const grid of [layer.base, layer.snow, layer.wet]) {
        expect(grid).toHaveLength(SKYLINE_HEIGHT);
        expect(grid.every(row => row.length === SKYLINE_WIDTH)).toBe(true);
      }
    }
    expect(skyline()).toBe(skyline());
  });

  it('keeps downtown below the summit of Mont Royal', () => {
    const summit = Math.min(...Array.from({ length: SKYLINE_WIDTH }, (_, x) => columnTop(far.base, x) ?? SKYLINE_HEIGHT)
      .filter((_, x) => x >= 100 && x <= 280));
    const towers = Array.from({ length: 160 }, (_, i) => columnTop(mid.base, 100 + i) ?? SKYLINE_HEIGHT);
    // Rows count down from the top, so a higher building has a smaller row index.
    expect(Math.min(...towers)).toBeGreaterThan(summit);
  });

  it('paves the whole street and keeps puddles on the road only', () => {
    for (let x = 0; x < SKYLINE_WIDTH; x++) expect(near.base[GROUND_Y]![x]).toBe('walk');
    const wetRows = near.wet.flatMap((row, y) => (row.some(Boolean) ? [y] : []));
    expect(Math.min(...wetRows)).toBeGreaterThan(GROUND_Y + 3);
  });

  it('lights some windows but not all of them', () => {
    const classes = [mid, near].flatMap(layer => layer.base.flat());
    const lit = classes.filter(c => c === 'win-lit').length;
    const unlit = classes.filter(c => c === 'win').length;
    expect(lit).toBeGreaterThan(0);
    expect(unlit).toBeGreaterThan(lit);
  });
});

describe('sprites', () => {
  it('parses the sky sprites and keeps stars inside the field', () => {
    expect(SUN).toHaveLength(15);
    expect(MOON).toHaveLength(11);
    expect(gridRuns(CLOUD_LARGE).length).toBeGreaterThan(0);
    expect(STARS.every(s => s.x >= 0 && s.x < STAR_FIELD.width && s.y >= 0 && s.y < STAR_FIELD.height)).toBe(true);
  });
});

describe('gridMarkup', () => {
  it('renders one rect per run with the px- class', () => {
    const grid = parseArt(['aab'], { a: 'roof', b: 'win-lit' });
    expect(gridMarkup(grid)).toBe(
      '<rect class="px-roof" x="0" y="0" width="2" height="1"/><rect class="px-win-lit" x="2" y="0" width="1" height="1"/>');
  });

  it('rejects class names that are not plain identifiers', () => {
    const grid = createGrid(1, 1);
    plot(grid, 0, 0, 'a" onload="x');
    expect(() => gridMarkup(grid)).toThrow(/Invalid class name/);
  });
});
