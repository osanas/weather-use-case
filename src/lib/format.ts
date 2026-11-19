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

export function formatTemperature(celsius: number | null): string {
  if (celsius === null || !Number.isFinite(celsius)) return UNAVAILABLE;
  const rounded = Math.round(celsius);
  // Avoid "-0 °C" for values that round to zero.
  return `${new Intl.NumberFormat('en-CA').format(rounded === 0 ? 0 : rounded)} °C`;
}

export function formatWind(kmh: number | null): string {
  if (kmh === null || !Number.isFinite(kmh)) return UNAVAILABLE;
  return `${Math.round(kmh)} km/h`;
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
