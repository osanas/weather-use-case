import { describe, expect, it } from 'vitest';
import { precipHeights, rangeSpan, stepSegments, temperatureDomain, temperatureRows } from './forecast-chart';

describe('temperatureRows', () => {
  it('puts the warmest reading on the top row and the coldest on the bottom row', () => {
    expect(temperatureRows([-10, 0, 10], 3, 16)).toEqual([16, 10, 3]);
  });

  it('rounds intermediate readings to whole rows', () => {
    expect(temperatureRows([0, 1, 3], 0, 10)).toEqual([10, 7, 0]);
  });

  it('keeps missing and non-finite readings as gaps without affecting the scale', () => {
    expect(temperatureRows([null, -8, Number.NaN, -4, Number.POSITIVE_INFINITY], 3, 16)).toEqual([null, 16, null, 3, null]);
  });

  it('places a flat series on the middle row', () => {
    expect(temperatureRows([5, 5, 5], 3, 16)).toEqual([10, 10, 10]);
  });

  it('returns only gaps when every reading is missing', () => {
    expect(temperatureRows([null, null], 3, 16)).toEqual([null, null]);
    expect(temperatureRows([], 3, 16)).toEqual([]);
  });
});

describe('precipHeights', () => {
  it('scales 0–100 % to the bar height', () => {
    expect(precipHeights([0, 50, 100], 10)).toEqual([0, 5, 10]);
  });

  it('clamps out-of-range probabilities', () => {
    expect(precipHeights([-5, 140], 11)).toEqual([0, 11]);
  });

  it('shows any chance above zero as at least one unit', () => {
    expect(precipHeights([1, 4], 11)).toEqual([1, 1]);
  });

  it('keeps missing readings as null', () => {
    expect(precipHeights([null, Number.NaN], 11)).toEqual([null, null]);
  });
});

describe('stepSegments', () => {
  it('draws a step per column and a joint on the boundary between different rows', () => {
    expect(stepSegments([10, 6, 6], 24, 2)).toEqual([
      { x: 0, y: 10, w: 24, h: 2 },
      { x: 23, y: 6, w: 2, h: 6 },
      { x: 24, y: 6, w: 24, h: 2 },
      { x: 48, y: 6, w: 24, h: 2 },
    ]);
  });

  it('leaves a gap around a missing reading', () => {
    expect(stepSegments([4, null, 8], 24, 2)).toEqual([
      { x: 0, y: 4, w: 24, h: 2 },
      { x: 48, y: 8, w: 24, h: 2 },
    ]);
  });

  it('draws nothing when every reading is missing', () => {
    expect(stepSegments([null, null], 24, 2)).toEqual([]);
  });
});

describe('temperatureDomain', () => {
  it('spans the lowest minimum and highest maximum, skipping missing readings', () => {
    expect(temperatureDomain([
      { minC: -12, maxC: -4 },
      { minC: null, maxC: 3 },
      { minC: -6, maxC: null },
    ])).toEqual({ min: -12, max: 3 });
  });

  it('is null without any reading', () => {
    expect(temperatureDomain([{ minC: null, maxC: null }])).toBeNull();
    expect(temperatureDomain([])).toBeNull();
  });
});

describe('rangeSpan', () => {
  const domain = { min: -10, max: 10 };

  it('positions the day within the shared domain', () => {
    expect(rangeSpan(-10, 10, domain, 12)).toEqual({ start: 0, width: 12 });
    expect(rangeSpan(0, 5, domain, 12)).toEqual({ start: 6, width: 3 });
  });

  it('swaps inverted readings', () => {
    expect(rangeSpan(5, 0, domain, 12)).toEqual({ start: 6, width: 3 });
  });

  it('is at least one unit wide, even at the warm end', () => {
    expect(rangeSpan(2, 2, domain, 12)).toEqual({ start: 7, width: 1 });
    expect(rangeSpan(10, 10, domain, 12)).toEqual({ start: 11, width: 1 });
  });

  it('fills the track when the domain has no extent', () => {
    expect(rangeSpan(4, 4, { min: 4, max: 4 }, 12)).toEqual({ start: 0, width: 12 });
  });

  it('is null when a reading or the domain is missing', () => {
    expect(rangeSpan(null, 5, domain, 12)).toBeNull();
    expect(rangeSpan(0, null, domain, 12)).toBeNull();
    expect(rangeSpan(0, 5, null, 12)).toBeNull();
  });
});
