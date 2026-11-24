import { isExpired } from '@/lib/forecast';
import type { WeatherResponse } from '@/lib/weather/types';

/**
 * Scene for the pixel-art Montréal backdrop, derived only from the current public
 * forecast. A `null` scene is the neutral "calm" world that claims no weather: it is
 * used while loading, after a failure, for an expired forecast or an unknown code.
 */
export type Sky = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export type Scene = {
  sky: Sky;
  night: boolean;
  /** At or below freezing, from the current temperature. */
  cold: boolean;
};

export type SceneKey = `${Sky}-${'day' | 'night'}` | 'calm';

const SKY_BY_CODE: Readonly<Record<number, Sky>> = {
  0: 'clear', 1: 'clear',
  2: 'cloudy', 3: 'cloudy',
  45: 'fog', 48: 'fog',
  51: 'rain', 53: 'rain', 55: 'rain', 56: 'rain', 57: 'rain',
  61: 'rain', 63: 'rain', 65: 'rain', 66: 'rain', 67: 'rain',
  80: 'rain', 81: 'rain', 82: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow', 85: 'snow', 86: 'snow',
  95: 'storm', 96: 'storm', 99: 'storm',
};

/** Sky for a WMO weather code, or `null` when the code is missing or not recognised. */
export function skyForCode(code: number | null): Sky | null {
  if (code === null) return null;
  return SKY_BY_CODE[code] ?? null;
}

// Fallback daylight hours when the provider gives no day/night flag.
const DAY_STARTS_AT = 6;
const NIGHT_STARTS_AT = 20;

function localHour(isoUtc: string, timeZone: string): number | null {
  const instant = Date.parse(isoUtc);
  if (Number.isNaN(instant)) return null;
  const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(instant)
    .find(part => part.type === 'hour')?.value;
  return hour === undefined ? null : Number(hour);
}

/** Night from the provider flag, else from the observation's local hour, else day. */
export function isNight(data: Pick<WeatherResponse, 'current' | 'fetchedAt' | 'timezone'>): boolean {
  if (data.current.isDay !== null) return !data.current.isDay;
  const hour = localHour(data.current.time ?? data.fetchedAt, data.timezone);
  if (hour === null) return false;
  return hour < DAY_STARTS_AT || hour >= NIGHT_STARTS_AT;
}

/** The scene for a forecast at `now`, or `null` for the neutral world. Pure. */
export function sceneFor(data: WeatherResponse | null, now: number): Scene | null {
  if (!data || isExpired(data.fetchedAt, now)) return null;
  const sky = skyForCode(data.current.weatherCode);
  if (!sky) return null;
  const temperature = data.current.temperatureC;
  return { sky, night: isNight(data), cold: temperature !== null && temperature <= 0 };
}

export function sceneKey(scene: Scene | null): SceneKey {
  return scene ? `${scene.sky}-${scene.night ? 'night' : 'day'}` : 'calm';
}
