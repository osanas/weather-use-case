'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { FORECAST_TTL_MS } from '@/lib/weather/cache';
import { loadForecast } from '@/lib/weather/client';
import type { WeatherResponse } from '@/lib/weather/types';
import { sceneFor, sceneKey, type Scene } from '@/lib/world/scene';
import { WorldBackdrop } from './WorldBackdrop';

/** The backdrop always shows Montréal, a public catalogue city, whatever city is selected. */
export const WORLD_CITY_ID = 'montreal-qc';

const TICK_MS = 15_000;
/** Refresh shortly before the forecast expires, so a fresh scene replaces it in time. */
const REFRESH_BEFORE_EXPIRY_MS = 45_000;
/** Never request more often than this, even if the server returns an older cached forecast. */
const MIN_REQUEST_GAP_MS = 60_000;

export type LiveWeather =
  | { status: 'loading' }
  | { status: 'ready'; data: WeatherResponse }
  | { status: 'error' };

type WorldValue = { live: LiveWeather; scene: Scene | null; now: number };

const WorldContext = createContext<WorldValue>({ live: { status: 'loading' }, scene: null, now: 0 });

/** Live Montréal weather and the scene derived from it. */
export const useWorld = () => useContext(WorldContext);

function useMontrealWeather(): { live: LiveWeather; now: number } {
  const [live, setLive] = useState<LiveWeather>({ status: 'loading' });
  const [now, setNow] = useState(0);
  const lastRequest = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const liveRef = useRef(live);
  useEffect(() => { liveRef.current = live; }, [live]);

  useEffect(() => {
    const request = () => {
      controller.current?.abort();
      const c = new AbortController();
      controller.current = c;
      lastRequest.current = Date.now();
      void loadForecast(WORLD_CITY_ID, c.signal).then(result => {
        if (c.signal.aborted) return;
        setNow(Date.now());
        setLive(result.ok ? { status: 'ready', data: result.data } : { status: 'error' });
      });
    };

    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (document.visibilityState !== 'visible' || t - lastRequest.current < MIN_REQUEST_GAP_MS) return;
      const current = liveRef.current;
      const due = current.status !== 'ready'
        || t - Date.parse(current.data.fetchedAt) >= FORECAST_TTL_MS - REFRESH_BEFORE_EXPIRY_MS;
      if (due) request();
    };

    request();
    const id = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      controller.current?.abort();
    };
  }, []);

  return { live, now };
}

/**
 * The "Plateau 16" world: a pixel-art Montréal backdrop whose scene follows the live
 * Montréal forecast, and the scene attributes that drive the page palette. `scenery` is
 * the static art, rendered on the server.
 */
export function World({ children, scenery }: { children: ReactNode; scenery: ReactNode }) {
  const { live, now } = useMontrealWeather();
  const scene = live.status === 'ready' ? sceneFor(live.data, now) : null;

  return (
    <WorldContext.Provider value={{ live, scene, now }}>
      <div
        className="world"
        data-scene={sceneKey(scene)}
        data-sky={scene?.sky ?? 'calm'}
        data-time={scene?.night ? 'night' : 'day'}
        data-cold={scene?.cold ? 'true' : 'false'}
      >
        <WorldBackdrop scene={scene} scenery={scenery} />
        <div className="world-content">{children}</div>
      </div>
    </WorldContext.Provider>
  );
}
