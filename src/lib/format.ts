import { TEMPERATURE_UNIT, toDisplay, WIND_UNIT, type Units } from './units';

export const UNAVAILABLE = 'Unavailable';

/** Formats a UTC instant in the given IANA time zone, never the visitor's zone. */
export function formatLocalTime(isoUtc: string | null, timeZone: string): string {
  if (!isoUtc) return UNAVAILABLE;
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(date);
}

/** Hour of a UTC instant in the city's zone, e.g. "14:00 EST". The zone name disambiguates repeated hours. */
export function formatHour(isoUtc: string | null, timeZone: string): string {
  if (!isoUtc) return UNAVAILABLE;
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return UNAVAILABLE;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(date);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a local calendar date (YYYY-MM-DD), e.g. "Fri, Jan 15".
 * The date is already local to the city, so it is formatted at UTC noon in UTC to avoid any shift.
 */
export function formatDay(date: string | null): string {
  const match = date ? ISO_DATE.exec(date) : null;
  if (!match) return UNAVAILABLE;
  const instant = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (Number.isNaN(instant)) return UNAVAILABLE;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(instant);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return UNAVAILABLE;
  return `${Math.round(value)}%`;
}

/** A temperature given in °C, shown in the visitor's units ("21 °C" or "70 °F"). */
export function formatTemperature(celsius: number | null, units: Units = 'metric'): string {
  if (celsius === null || !Number.isFinite(celsius)) return UNAVAILABLE;
  const rounded = Math.round(toDisplay(celsius, 'temperature', units));
  // Avoid "-0 °C" for values that round to zero.
  return `${new Intl.NumberFormat('en-CA').format(rounded === 0 ? 0 : rounded)} ${TEMPERATURE_UNIT[units]}`;
}

/** A wind speed given in km/h, shown in the visitor's units ("28 km/h" or "17 mph"). */
export function formatWind(kmh: number | null, units: Units = 'metric'): string {
  if (kmh === null || !Number.isFinite(kmh)) return UNAVAILABLE;
  return `${Math.round(toDisplay(kmh, 'wind', units))} ${WIND_UNIT[units]}`;
}

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export function describeWeatherCode(code: number | null): string {
  if (code === null) return UNAVAILABLE;
  return WMO_LABELS[code] ?? UNAVAILABLE;
}
