import { getMessages, INTL_LOCALE, type Locale } from './i18n';
import { TEMPERATURE_UNIT, toDisplay, WIND_UNIT, type Units } from './units';

export const unavailable = (locale: Locale = 'en') => getMessages(locale).common.unavailable;
export const UNAVAILABLE = unavailable('en');

/** Formats a UTC instant in the given IANA time zone, never the visitor's zone. */
export function formatLocalTime(isoUtc: string | null, timeZone: string, locale: Locale = 'en'): string {
  if (!isoUtc) return unavailable(locale);
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return unavailable(locale);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
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
export function formatHour(isoUtc: string | null, timeZone: string, locale: Locale = 'en'): string {
  if (!isoUtc) return unavailable(locale);
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return unavailable(locale);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
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
export function formatDay(date: string | null, locale: Locale = 'en'): string {
  const match = date ? ISO_DATE.exec(date) : null;
  if (!match) return unavailable(locale);
  const instant = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (Number.isNaN(instant)) return unavailable(locale);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(instant);
}

export function formatPercent(value: number | null, locale: Locale = 'en'): string {
  if (value === null || !Number.isFinite(value)) return unavailable(locale);
  // French puts a no-break space before the percent sign.
  return `${Math.round(value)}${locale === 'fr' ? '\u00a0' : ''}%`;
}

/** A temperature given in °C, shown in the visitor's units ("21 °C" or "70 °F"). */
export function formatTemperature(celsius: number | null, units: Units = 'metric', locale: Locale = 'en'): string {
  if (celsius === null || !Number.isFinite(celsius)) return unavailable(locale);
  const rounded = Math.round(toDisplay(celsius, 'temperature', units));
  // Avoid "-0 °C" for values that round to zero.
  return `${new Intl.NumberFormat(INTL_LOCALE[locale]).format(rounded === 0 ? 0 : rounded)} ${TEMPERATURE_UNIT[units]}`;
}

/** A wind speed given in km/h, shown in the visitor's units ("28 km/h" or "17 mph"). */
export function formatWind(kmh: number | null, units: Units = 'metric', locale: Locale = 'en'): string {
  if (kmh === null || !Number.isFinite(kmh)) return unavailable(locale);
  return `${Math.round(toDisplay(kmh, 'wind', units))} ${WIND_UNIT[units]}`;
}

export function describeWeatherCode(code: number | null, locale: Locale = 'en'): string {
  if (code === null) return unavailable(locale);
  return getMessages(locale).weather[code] ?? unavailable(locale);
}
