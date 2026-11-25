'use client';

import { describeWeatherCode, formatHour, formatTemperature } from '@/lib/format';
import { useWorld } from './World';
import { useLocale, useMessages } from '../Language';
import { useUnits } from '../Units';

/**
 * States what the backdrop shows. Only a fresh forecast is described as live; an
 * expired or failed one says so instead (WX-03). Not a live region: it changes on a
 * timer, which would interrupt screen-reader users.
 */
export function LiveWeatherLabel() {
  const { live, scene } = useWorld();
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();

  let text: string;
  if (live.status === 'loading') {
    text = t.live.loading;
  } else if (live.status === 'ready' && scene) {
    const { current, fetchedAt, timezone } = live.data;
    text = t.live.now(describeWeatherCode(current.weatherCode, locale), formatTemperature(current.temperatureC, units, locale),
      formatHour(fetchedAt, timezone, locale));
  } else {
    text = t.live.unavailable;
  }

  return (
    <p className="live-label" data-state={scene ? 'live' : live.status === 'loading' ? 'loading' : 'unavailable'}>
      <span className="live-dot" aria-hidden="true" />
      {text}
    </p>
  );
}
