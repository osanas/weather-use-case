'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Units } from '@/lib/units';
import { useMessages } from './Language';

/** Per-browser display preference; not personal data, never sent. */
const KEY = 'weather-window.units';
const CHANGE = 'weather-window:units';

function read(): Units {
  try {
    return window.localStorage.getItem(KEY) === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

let memory: Units | null = null;
const snapshot = () => memory ?? read();

function save(units: Units) {
  memory = units;
  try {
    window.localStorage.setItem(KEY, units);
  } catch {
    // Storage blocked: the choice still holds for this page.
  }
  window.dispatchEvent(new Event(CHANGE));
}

const UnitsContext = createContext<Units>('metric');

/** Metric on the server and until the browser's saved choice is read. */
export function UnitsProvider({ children }: { children: ReactNode }) {
  const units = useSyncExternalStore(subscribe, snapshot, () => 'metric' as const);
  return <UnitsContext.Provider value={units}>{children}</UnitsContext.Provider>;
}

export const useUnits = () => useContext(UnitsContext);

/** Two-option switch between °C/km/h and °F/mph. */
export function UnitsToggle() {
  const units = useUnits();
  const t = useMessages();
  return (
    <div className="units-toggle" role="group" aria-label={t.header.units}>
      {(['metric', 'imperial'] as const).map(option => (
        <button
          key={option}
          type="button"
          aria-pressed={units === option}
          onClick={() => save(option)}
        >
          {option === 'metric' ? '°C · km/h' : '°F · mph'}
        </button>
      ))}
    </div>
  );
}
