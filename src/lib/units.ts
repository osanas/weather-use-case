/**
 * Display units (WEA-23). Only what is shown changes: the API, the planner, the thresholds
 * and the AI all stay metric, and every conversion happens at render time.
 */
export type Units = 'metric' | 'imperial';

export const fahrenheit = (celsius: number) => celsius * 9 / 5 + 32;
export const mph = (kmh: number) => kmh / 1.609344;

/** A temperature in °C or a wind speed in km/h, converted for display. */
export function toDisplay(value: number, kind: 'temperature' | 'wind', units: Units): number {
  if (units === 'metric') return value;
  return kind === 'temperature' ? fahrenheit(value) : mph(value);
}

export const TEMPERATURE_UNIT: Record<Units, string> = { metric: '°C', imperial: '°F' };
export const WIND_UNIT: Record<Units, string> = { metric: 'km/h', imperial: 'mph' };
