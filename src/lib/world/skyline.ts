import { createGrid, fillDisc, fillRect, line, plot, seededRandom, type Grid } from './pixels';

/**
 * The "Plateau 16" Montréal skyline, drawn procedurally at 480 × 135 art pixels and
 * identical on every render (fixed seeds). Original artwork: simplified silhouettes of
 * public landmarks, no third-party sprites.
 *
 * Each layer has a base grid plus overlays that the scene's CSS shows or hides:
 * `snow` (caps on roofs, steps and trees) and `wet` (puddles on the street).
 */
export const SKYLINE_WIDTH = 480;
export const SKYLINE_HEIGHT = 135;
/** Row where buildings meet the sidewalk. */
export const GROUND_Y = 126;
/** Farther layers stand higher in the frame, so they show above the street in front. */
const FAR_BASE = GROUND_Y - 26;
const MID_BASE = GROUND_Y - 16;

export type SkylineLayer = { base: Grid; snow: Grid; wet: Grid };

const newLayer = (): SkylineLayer => ({
  base: createGrid(SKYLINE_WIDTH, SKYLINE_HEIGHT),
  snow: createGrid(SKYLINE_WIDTH, SKYLINE_HEIGHT),
  wet: createGrid(SKYLINE_WIDTH, SKYLINE_HEIGHT),
});

/** Highest filled row of a column in a grid, or `null` for an empty column. */
export function columnTop(grid: Grid, x: number): number | null {
  for (let y = 0; y < grid.length; y++) if (grid[y]![x]) return y;
  return null;
}

/** Puts a snow pixel on top of every filled column in [x0, x1). */
function capColumns(layer: SkylineLayer, x0: number, x1: number, depth = 1): void {
  for (let x = x0; x < x1; x++) {
    const top = columnTop(layer.base, x);
    if (top === null) continue;
    for (let d = 0; d < depth; d++) plot(layer.snow, x, top + d, 'snow');
  }
}

/** Mont Royal with its cross, the Biosphère and the Olympic Stadium's leaning tower. */
function farLayer(): SkylineLayer {
  const layer = newLayer();
  const { base } = layer;

  // Mont Royal: a broad mound peaking at 64 px, the height limit downtown stays under.
  const cx = 190;
  const r = 165;
  for (let x = cx - r; x <= cx + r; x++) {
    const t = (x - cx) / r;
    const h = Math.round(64 * Math.pow(1 - t * t, 0.85) + 2 * Math.sin(x / 9));
    fillRect(base, x, FAR_BASE - h, 1, h, 'far');
    // Sunlit ridge on the western slope.
    if (x < cx) fillRect(base, x, FAR_BASE - h, 1, 2, 'far-hi');
  }
  capColumns(layer, cx - r, cx + r + 1, 2);
  // Distant shoreline under the mountain, down to the street.
  fillRect(base, 0, FAR_BASE, SKYLINE_WIDTH, GROUND_Y - FAR_BASE, 'far');

  // The cross on the summit, slightly east of the peak.
  const crossX = cx + 22;
  const summit = columnTop(base, crossX) ?? FAR_BASE - 60;
  fillRect(base, crossX, summit - 13, 2, 13, 'cross');
  fillRect(base, crossX - 3, summit - 10, 8, 2, 'cross');

  // Biosphère: a geodesic sphere on Île Sainte-Hélène (west edge).
  const bx = 34;
  const by = FAR_BASE - 13;
  for (let j = -14; j <= 13; j++) {
    for (let i = -14; i <= 14; i++) {
      if (i * i + j * j > 14 * 14 + 10) continue;
      const lattice = (bx + i + by + j) % 4 === 0 || (bx + i - by - j + 400) % 4 === 0;
      plot(base, bx + i, by + j, lattice ? 'far-hi' : 'far');
    }
  }

  // Olympic Stadium: the bowl and its 45° leaning tower.
  for (let x = 380; x <= 458; x++) {
    const t = (x - 419) / 39;
    const h = Math.round(11 * Math.sqrt(Math.max(0, 1 - t * t)));
    fillRect(base, x, FAR_BASE - h, 1, h, 'far');
  }
  for (let i = 0; i < 62; i++) {
    const x = 384 + Math.floor(i * 0.62);
    fillRect(base, x, FAR_BASE - 8 - i, i < 56 ? 5 : 7, 1, 'tower');
  }
  fillRect(base, 419, FAR_BASE - 76, 9, 4, 'tower');
  capColumns(layer, 380, 460);
  return layer;
}

type Tower = { x: number; w: number; h: number; kind?: 'pvm' | 'copper' };

// Downtown stays below the mountain's summit, as Montréal's height limit requires.
const TOWERS: readonly Tower[] = [
  { x: 104, w: 14, h: 30 }, { x: 120, w: 12, h: 40 }, { x: 134, w: 22, h: 50, kind: 'pvm' },
  { x: 158, w: 12, h: 36 }, { x: 172, w: 16, h: 52, kind: 'copper' }, { x: 190, w: 12, h: 34 },
  { x: 204, w: 16, h: 44 }, { x: 222, w: 10, h: 28 }, { x: 234, w: 14, h: 38 },
];

/** Downtown towers (with Place Ville Marie and a copper-roofed tower) and Jacques-Cartier bridge. */
function midLayer(): SkylineLayer {
  const layer = newLayer();
  const { base } = layer;
  const rnd = seededRandom(1642);

  for (const t of TOWERS) {
    const top = MID_BASE - t.h;
    fillRect(base, t.x, top, t.w, t.h, 'mid');
    fillRect(base, t.x, top, 1, t.h, 'mid-hi');
    for (let y = top + 3; y < MID_BASE - 2; y += 3) {
      for (let x = t.x + 2; x < t.x + t.w - 1; x += 2) {
        plot(base, x, y, rnd() < 0.34 ? 'win-lit' : 'win');
      }
    }
    if (t.kind === 'pvm') {
      // Cruciform plan seen from the side: recessed corners as darker vertical bands.
      fillRect(base, t.x + 6, top, 1, t.h, 'mid-lo');
      fillRect(base, t.x + t.w - 7, top, 1, t.h, 'mid-lo');
      fillRect(base, t.x + Math.floor(t.w / 2) - 1, top - 3, 2, 3, 'mid');
      plot(base, t.x + Math.floor(t.w / 2), top - 4, 'beacon');
      plot(base, t.x + Math.floor(t.w / 2) - 1, top - 4, 'beacon');
    }
    if (t.kind === 'copper') {
      const half = Math.floor(t.w / 2);
      for (let i = 0; i < half; i++) fillRect(base, t.x + i, top - (i + 1), t.w - 2 * i, 1, 'roof-cu');
    }
    capColumns(layer, t.x, t.x + t.w);
  }

  // Jacques-Cartier bridge: deck, piers and a truss that rises over the main span.
  // Lower town between downtown and the street, visible through the lanes.
  fillRect(base, 0, MID_BASE, SKYLINE_WIDTH, GROUND_Y - MID_BASE, 'mid-lo');
  for (let x = 2; x < SKYLINE_WIDTH; x += 4) plot(base, x, MID_BASE + 3 + (x % 3), rnd() < 0.3 ? 'win-lit' : 'win');

  const deckY = 82;
  fillRect(base, 300, deckY, SKYLINE_WIDTH - 300, 2, 'bridge');
  for (let x = 306; x < SKYLINE_WIDTH; x += 34) fillRect(base, x, deckY + 2, 3, MID_BASE - deckY - 2, 'bridge');
  const chord = (x: number) => {
    if (x < 352 || x > 432) return deckY - 9;
    const t = (x - 392) / 40;
    return Math.round(deckY - 9 - 13 * (1 - t * t));
  };
  for (let x = 300; x < SKYLINE_WIDTH; x++) plot(base, x, chord(x), 'bridge');
  for (let x = 300; x + 8 <= SKYLINE_WIDTH; x += 8) {
    line(base, x, deckY - 1, x + 4, chord(x + 4), 'bridge');
    line(base, x + 4, chord(x + 4), x + 8, deckY - 1, 'bridge');
  }
  for (let x = 300; x < SKYLINE_WIDTH; x++) plot(layer.snow, x, deckY - 1, 'snow');
  return layer;
}

/** One Plateau plex: brick body, cornice, windows, balconies and an exterior staircase. */
function plex(layer: SkylineLayer, x: number, w: number, h: number, variant: number, rnd: () => number): void {
  const { base, snow } = layer;
  const top = GROUND_Y - h;
  const brick = variant % 3 === 0 ? 'brick-b' : variant % 3 === 1 ? 'brick' : 'brick-c';
  fillRect(base, x, top, w, h, brick);
  fillRect(base, x, top, 1, h, 'brick-hi');

  // Cornice with dentils.
  fillRect(base, x - 1, top - 2, w + 2, 2, 'trim');
  for (let i = x; i < x + w; i += 2) plot(base, i, top, 'trim');
  fillRect(snow, x - 1, top - 3, w + 2, 1, 'snow');

  // Floors: windows with lintels; balconies on upper floors.
  const floors = h >= 40 ? 3 : 2;
  const floorH = Math.floor((h - 2) / floors);
  for (let f = 0; f < floors; f++) {
    const floorTop = top + 2 + f * floorH;
    const ground = f === floors - 1;
    const windows = ground ? [x + w - 8] : [x + 4, x + w - 8];
    for (const wx of windows) {
      fillRect(base, wx - 1, floorTop + 2, 6, 1, 'trim');
      fillRect(base, wx, floorTop + 3, 4, 5, rnd() < 0.4 ? 'win-lit' : 'win');
      plot(base, wx + 2, floorTop + 3, 'trim');
    }
    if (ground) {
      fillRect(base, x + 3, GROUND_Y - 9, 4, 9, 'door');
      fillRect(base, x + 2, GROUND_Y - 10, 6, 1, 'trim');
    } else {
      // Balcony slab and railing at the bottom of the floor.
      const by = floorTop + floorH;
      fillRect(base, x - 1, by - 1, w + 2, 1, 'stair');
      for (let i = x - 1; i <= x + w; i += 2) plot(base, i, by - 3, 'stair');
      fillRect(base, x - 1, by - 4, w + 2, 1, 'stair');
      fillRect(snow, x - 1, by - 5, w + 2, 1, 'snow');
    }
  }

  // Exterior staircase from the sidewalk up to the second-floor balcony.
  const landing = top + 2 + (floors - 1) * floorH - 1;
  const steps = GROUND_Y - landing;
  for (let i = 0; i < steps; i++) {
    const sx = x + w + 1 - Math.floor(i * 0.75);
    plot(base, sx, GROUND_Y - 1 - i, 'stair');
    plot(base, sx + 1, GROUND_Y - 1 - i, 'stair');
    if (i % 2 === 0) plot(snow, sx, GROUND_Y - 2 - i, 'snow');
  }
  line(base, x + w + 2, GROUND_Y - 6, x + w + 2 - Math.floor(steps * 0.75), landing - 5, 'stair');
}

function tree(layer: SkylineLayer, x: number, size: number): void {
  const { base } = layer;
  fillRect(base, x - 1, GROUND_Y - 12, 2, 12, 'trunk');
  fillDisc(base, x, GROUND_Y - 14 - size, size, 'tree');
  fillDisc(base, x - 2, GROUND_Y - 16 - size, Math.max(1, size - 4), 'tree-hi');
  capColumns(layer, x - size, x + size + 1);
}

/** A street of plexes and trees, the sidewalk and the road (with puddles when wet). */
function nearLayer(): SkylineLayer {
  const layer = newLayer();
  const { base, wet } = layer;
  const rnd = seededRandom(514);

  let x = -6;
  let i = 0;
  while (x < SKYLINE_WIDTH) {
    const w = [26, 30, 28, 34][i % 4]!;
    const h = [34, 42, 38, 44, 36][i % 5]!;
    plex(layer, x, w, h, i, rnd);
    x += w + 5;
    if (i % 3 === 2) {
      tree(layer, x + 5, 6 + (i % 2));
      x += 12;
    }
    i++;
  }

  // Sidewalk, curb and road with a dashed centre line.
  fillRect(base, 0, GROUND_Y, SKYLINE_WIDTH, 3, 'walk');
  fillRect(base, 0, GROUND_Y + 3, SKYLINE_WIDTH, 1, 'curb');
  fillRect(base, 0, GROUND_Y + 4, SKYLINE_WIDTH, SKYLINE_HEIGHT - GROUND_Y - 4, 'road');
  for (let rx = 0; rx < SKYLINE_WIDTH; rx += 10) fillRect(base, rx, GROUND_Y + 6, 5, 1, 'road-line');

  // Puddles, shown only in rain and storms.
  for (const px of [40, 118, 205, 296, 377, 450]) {
    fillRect(wet, px, GROUND_Y + 5, 12, 1, 'puddle');
    fillRect(wet, px + 2, GROUND_Y + 7, 9, 1, 'puddle');
    plot(wet, px + 4, GROUND_Y + 5, 'puddle-hi');
  }
  return layer;
}

export type Skyline = { far: SkylineLayer; mid: SkylineLayer; near: SkylineLayer };

let cached: Skyline | null = null;

/** Builds the three layers once; the art never changes between renders. */
export function skyline(): Skyline {
  cached ??= { far: farLayer(), mid: midLayer(), near: nearLayer() };
  return cached;
}

/** Puddle positions (art pixels) where ripples are animated in rain. */
export const PUDDLES: readonly { x: number; y: number }[] =
  [40, 118, 205, 296, 377, 450].map(x => ({ x: x + 6, y: GROUND_Y + 6 }));
