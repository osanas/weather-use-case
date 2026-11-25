import { describe, expect, it } from 'vitest';
import { formatTemperature, formatWind } from './format';
import { fahrenheit, mph, toDisplay } from './units';
import { compactValue } from './weather-widget';

describe('display units', () => {
  it('converts at the usual reference points', () => {
    expect(fahrenheit(0)).toBe(32);
    expect(fahrenheit(-40)).toBe(-40);
    expect(fahrenheit(100)).toBe(212);
    expect(mph(1.609344)).toBeCloseTo(1, 10);
    expect(toDisplay(20, 'temperature', 'metric')).toBe(20);
  });

  it('formats in either unit and keeps metric as the default', () => {
    expect(formatTemperature(21)).toBe('21 °C');
    expect(formatTemperature(21, 'imperial')).toBe('70 °F');
    expect(formatTemperature(-17.9, 'imperial')).toBe('0 °F');
    expect(formatWind(28)).toBe('28 km/h');
    expect(formatWind(28, 'imperial')).toBe('17 mph');
    expect(formatWind(null, 'imperial')).toBe('Unavailable');
  });

  it('converts the short chart values but never the precipitation chance', () => {
    expect(compactValue(10, 'temperature', 'imperial')).toBe('50°');
    expect(compactValue(32, 'wind', 'imperial')).toBe('20');
    expect(compactValue(40, 'precipitation', 'imperial')).toBe('40%');
  });
});
