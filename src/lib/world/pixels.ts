/**
 * Minimal pixel-art raster. Art is described as a grid of CSS class names (one per
 * pixel, `null` for transparent) so colours come from the scene's CSS tokens, and is
 * rendered as horizontal runs of `<rect>`s with crisp edges.
 */
export type Grid = (string | null)[][];

export type Run = { x: number; y: number; w: number; cls: string };

export function createGrid(width: number, height: number): Grid {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('Grid size must be positive integers');
  }
  return Array.from({ length: height }, () => Array<string | null>(width).fill(null));
}

export const gridWidth = (grid: Grid) => grid[0]?.length ?? 0;

/** Sets one pixel; out-of-bounds pixels are clipped. */
export function plot(grid: Grid, x: number, y: number, cls: string | null): void {
  const row = grid[y];
  if (!row || x < 0 || x >= row.length || !Number.isInteger(x)) return;
  row[x] = cls;
}

/** Fills a rectangle; parts outside the grid are clipped. */
export function fillRect(grid: Grid, x: number, y: number, w: number, h: number, cls: string | null): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) plot(grid, i, j, cls);
}

/** Fills a disc of radius `r` centred on pixel (cx, cy). */
export function fillDisc(grid: Grid, cx: number, cy: number, r: number, cls: string | null): void {
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      if (i * i + j * j <= r * r + r * 0.8) plot(grid, cx + i, cy + j, cls);
    }
  }
}

/** Draws a one-pixel line between two pixels (Bresenham). */
export function line(grid: Grid, x0: number, y0: number, x1: number, y1: number, cls: string | null): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    plot(grid, x, y, cls);
    if (x === x1 && y === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/**
 * Parses ASCII art. Each character maps to a class through `legend`; `.` and space are
 * transparent. Rows must have equal length and every other character must be in the legend.
 */
export function parseArt(rows: readonly string[], legend: Readonly<Record<string, string>>): Grid {
  const width = rows[0]?.length ?? 0;
  if (width === 0) throw new RangeError('Art must have at least one column');
  return rows.map((row, y) => {
    if (row.length !== width) throw new RangeError(`Art row ${y} has length ${row.length}, expected ${width}`);
    return Array.from(row, ch => {
      if (ch === '.' || ch === ' ') return null;
      const cls = legend[ch];
      if (!cls) throw new RangeError(`Unknown art character "${ch}" in row ${y}`);
      return cls;
    });
  });
}

/** Copies non-transparent pixels of `art` onto `grid` at (x, y). */
export function stamp(grid: Grid, art: Grid, x: number, y: number): void {
  art.forEach((row, j) => row.forEach((cls, i) => { if (cls) plot(grid, x + i, y + j, cls); }));
}

/** Merges each row's consecutive same-class pixels into runs. Pure. */
export function gridRuns(grid: Grid): Run[] {
  const runs: Run[] = [];
  grid.forEach((row, y) => {
    let start = 0;
    for (let x = 1; x <= row.length; x++) {
      const cls = row[start];
      if (x < row.length && row[x] === cls) continue;
      if (cls) runs.push({ x: start, y, w: x - start, cls });
      start = x;
    }
  });
  return runs;
}

/** Deterministic pseudo-random sequence (mulberry32), so the art is identical on every render. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLASS_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * SVG markup for a grid's runs. The art is static and generated from our own constants,
 * so it is rendered as opaque markup that React does not hydrate node by node; this keeps
 * thousands of rects off the hydration path. Class names are checked anyway.
 */
export function gridMarkup(grid: Grid): string {
  return gridRuns(grid).map(run => {
    if (!CLASS_NAME.test(run.cls)) throw new RangeError(`Invalid class name "${run.cls}"`);
    return `<rect class="px-${run.cls}" x="${run.x}" y="${run.y}" width="${run.w}" height="1"/>`;
  }).join('');
}
