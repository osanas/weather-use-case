/**
 * Pure scaling for the pixel forecast curve. Everything is in whole chart units, so the SVG
 * stays on a pixel grid. Missing readings stay `null` and are never drawn.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Domain = { min: number; max: number };

export const finite = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value);

/** Lowest and highest known value, or `null` when no value is known. */
export function dataDomain(values: readonly (number | null)[]): Domain | null {
  const known = values.filter(finite);
  if (known.length === 0) return null;
  return { min: Math.min(...known), max: Math.max(...known) };
}

/**
 * Row of each value between `top` (domain max) and `bottom` (domain min), rounded to whole
 * units and clamped to the band. A domain without extent puts every value on the middle row.
 * Missing or non-finite values, or a missing domain, give `null`.
 */
export function scaleRows(
  values: readonly (number | null)[],
  domain: Domain | null,
  top: number,
  bottom: number,
): (number | null)[] {
  const middle = Math.round((top + bottom) / 2);
  return values.map(value => {
    if (!finite(value) || !domain) return null;
    const extent = domain.max - domain.min;
    if (extent <= 0) return middle;
    const row = Math.round(bottom - ((value - domain.min) / extent) * (bottom - top));
    return Math.min(bottom, Math.max(top, row));
  });
}

/** Rows of a series scaled to its own range: the warmest reading on `top`, the coldest on `bottom`. */
export function temperatureRows(values: readonly (number | null)[], top: number, bottom: number): (number | null)[] {
  return scaleRows(values, dataDomain(values), top, bottom);
}

/**
 * Rects of a stepped line: a horizontal step across each column with a known row, and a
 * vertical joint on the boundary between neighbouring known columns. Missing rows leave gaps.
 */
export function stepSegments(rows: readonly (number | null)[], colWidth: number, thickness: number): Rect[] {
  const rects: Rect[] = [];
  rows.forEach((row, i) => {
    if (row === null) return;
    rects.push({ x: i * colWidth, y: row, w: colWidth, h: thickness });
    const next = rows[i + 1];
    if (next === null || next === undefined || next === row) return;
    rects.push({
      x: (i + 1) * colWidth - Math.floor(thickness / 2),
      y: Math.min(row, next),
      w: thickness,
      h: Math.abs(next - row) + thickness,
    });
  });
  return rects;
}

/** Filled area under a stepped line: one column from its row down to `bottom`. Gaps stay empty. */
export function areaRects(rows: readonly (number | null)[], colWidth: number, bottom: number): Rect[] {
  return rows.flatMap((row, i) => row === null || row >= bottom ? [] : [{ x: i * colWidth, y: row, w: colWidth, h: bottom - row }]);
}
