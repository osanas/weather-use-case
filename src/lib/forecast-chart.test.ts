import { describe, expect, it } from 'vitest';
import { areaRects, dataDomain, scaleRows, stepSegments, temperatureRows } from './forecast-chart';

describe('dataDomain', () => {
  it('spans the known values and skips missing ones', () => {
    expect(dataDomain([3, null, -2, Number.NaN, 7])).toEqual({ min: -2, max: 7 });
  });

  it('is null without any known value', () => {
    expect(dataDomain([null, Number.POSITIVE_INFINITY])).toBeNull();
    expect(dataDomain([])).toBeNull();
  });
});

describe('scaleRows', () => {
  it('maps the domain max to the top row and the min to the bottom row', () => {
    expect(scaleRows([0, 50, 100], { min: 0, max: 100 }, 10, 46)).toEqual([46, 28, 10]);
  });

  it('clamps values outside the domain to the band', () => {
    expect(scaleRows([-20, 140], { min: 0, max: 100 }, 10, 46)).toEqual([46, 10]);
  });

  it('puts every value on the middle row when the domain has no extent', () => {
    expect(scaleRows([4, 4], { min: 4, max: 4 }, 10, 46)).toEqual([28, 28]);
  });

  it('keeps missing values, and everything without a domain, as gaps', () => {
    expect(scaleRows([null, Number.NaN, 5], { min: 0, max: 10 }, 0, 10)).toEqual([null, null, 5]);
    expect(scaleRows([1, 2], null, 0, 10)).toEqual([null, null]);
  });
});

describe('temperatureRows', () => {
  it('scales a series to its own range', () => {
    expect(temperatureRows([-10, 0, 10], 3, 16)).toEqual([16, 10, 3]);
    expect(temperatureRows([0, 1, 3], 0, 10)).toEqual([10, 7, 0]);
  });

  it('keeps gaps and places a flat series on the middle row', () => {
    expect(temperatureRows([null, -8, Number.NaN, -4], 3, 16)).toEqual([null, 16, null, 3]);
    expect(temperatureRows([5, 5], 3, 16)).toEqual([10, 10]);
    expect(temperatureRows([null, null], 3, 16)).toEqual([null, null]);
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
    expect(stepSegments([null, null], 24, 2)).toEqual([]);
  });
});

describe('areaRects', () => {
  it('fills each known column from its row down to the bottom', () => {
    expect(areaRects([10, null, 46, 48], 12, 48)).toEqual([
      { x: 0, y: 10, w: 12, h: 38 },
      { x: 24, y: 46, w: 12, h: 2 },
    ]);
  });
});
