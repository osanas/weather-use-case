/**
 * Pure scaling for the pixel forecast charts. Everything is in whole chart units, so the
 * SVGs stay on a crisp pixel grid. Missing readings stay `null` and are never drawn.
 */

export type Rect = { x: number; y: number; w: number; h: number };

const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);

/**
 * Row of each temperature between `top` (warmest) and `bottom` (coldest), rounded to whole
 * units. A flat series sits on the middle row. Missing or non-finite values give `null`.
 */
export function temperatureRows(values: readonly (number | null)[], top: number, bottom: number): (number | null)[] {
  const known = values.filter(finite);
  if (known.length === 0) return values.map(() => null);
  const min = Math.min(...known);
  const max = Math.max(...known);
  const middle = Math.round((top + bottom) / 2);
  return values.map(value => {
    if (!finite(value)) return null;
    if (max === min) return middle;
    return Math.round(bottom - ((value - min) / (max - min)) * (bottom - top));
  });
}

/**
 * Bar height for each precipitation probability (0–100 %, clamped), out of `maxHeight`
 * units. Any chance above zero shows at least one unit. Missing values give `null`.
 */
export function precipHeights(values: readonly (number | null)[], maxHeight: number): (number | null)[] {
  return values.map(value => {
    if (!finite(value)) return null;
    const percent = Math.min(100, Math.max(0, value));
    const height = Math.round((percent / 100) * maxHeight);
    return percent > 0 ? Math.max(1, height) : 0;
  });
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

export type Domain = { min: number; max: number };

/** Lowest minimum and highest maximum across days, or `null` when no reading is known. */
export function temperatureDomain(days: readonly { minC: number | null; maxC: number | null }[]): Domain | null {
  const known = days.flatMap(day => [day.minC, day.maxC]).filter(finite);
  if (known.length === 0) return null;
  return { min: Math.min(...known), max: Math.max(...known) };
}

/**
 * Filled part of a day's min–max bar on a track of `units`, positioned within the shared
 * domain. Inverted readings are swapped; the span is at least one unit wide. `null` when
 * either reading or the domain is missing.
 */
export function rangeSpan(
  min: number | null,
  max: number | null,
  domain: Domain | null,
  units: number,
): { start: number; width: number } | null {
  if (!finite(min) || !finite(max) || !domain) return null;
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const extent = domain.max - domain.min;
  if (extent <= 0) return { start: 0, width: units };
  const scale = (value: number) => Math.min(units, Math.max(0, Math.round(((value - domain.min) / extent) * units)));
  const start = Math.min(scale(low), units - 1);
  return { start, width: Math.max(1, scale(high) - start) };
}
