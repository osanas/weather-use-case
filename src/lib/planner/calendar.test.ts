import { describe, expect, it } from 'vitest';
import { addMonths, datesIn, monthGrid, monthLabel, moveDate, weekday } from './calendar';

const bounds = { min: '2027-06-28', max: '2027-07-04' };

describe('calendar', () => {
  it('lays out a month in Sunday-first weeks', () => {
    const grid = monthGrid('2027-06-14');
    expect(grid[0]).toEqual([null, null, '2027-06-01', '2027-06-02', '2027-06-03', '2027-06-04', '2027-06-05']);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
    expect(grid.every(week => week.length === 7)).toBe(true);
    expect(monthLabel('2027-06-14')).toBe('June 2027');
  });

  it('lists the horizon across a month end', () => {
    expect(datesIn(bounds)).toEqual(['2027-06-28', '2027-06-29', '2027-06-30', '2027-07-01', '2027-07-02', '2027-07-03', '2027-07-04']);
    expect(weekday('2027-07-04')).toBe(0);
  });

  it('moves with the keyboard and stays inside the horizon', () => {
    expect(moveDate('2027-06-30', 'ArrowRight', bounds)).toBe('2027-07-01');
    expect(moveDate('2027-06-30', 'ArrowDown', bounds)).toBe('2027-07-04');
    expect(moveDate('2027-06-29', 'ArrowUp', bounds)).toBe('2027-06-28');
    expect(moveDate('2027-07-01', 'Home', bounds)).toBe('2027-06-28');
    expect(moveDate('2027-06-29', 'End', bounds)).toBe('2027-07-03');
    expect(moveDate('2027-06-30', 'PageDown', bounds)).toBe('2027-07-04');
    expect(moveDate('2027-07-02', 'PageUp', bounds)).toBe('2027-06-28');
  });

  it('clamps month steps to shorter months', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2027-03-31', -1)).toBe('2027-02-28');
  });
});
