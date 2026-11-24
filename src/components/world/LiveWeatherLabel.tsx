'use client';

import { describeWeatherCode, formatHour, formatTemperature } from '@/lib/format';
import { useWorld } from './World';

/**
 * States what the backdrop shows. Only a fresh forecast is described as live; an
 * expired or failed one says so instead (WX-03). Not a live region: it changes on a
 * timer, which would interrupt screen-reader users.
 */
export function LiveWeatherLabel() {
  const { live, scene } = useWorld();

  let text: string;
  if (live.status === 'loading') {
    text = 'Loading live Montréal weather…';
  } else if (live.status === 'ready' && scene) {
    const { current, fetchedAt, timezone } = live.data;
    text = `Live in Montréal: ${describeWeatherCode(current.weatherCode)}, ${formatTemperature(current.temperatureC)}`
      + ` · Updated ${formatHour(fetchedAt, timezone)}`;
  } else {
    text = 'Live Montréal weather is unavailable right now.';
  }

  return (
    <p className="live-label" data-state={scene ? 'live' : live.status === 'loading' ? 'loading' : 'unavailable'}>
      <span className="live-dot" aria-hidden="true" />
      {text}
    </p>
  );
}
