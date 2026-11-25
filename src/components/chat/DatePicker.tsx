'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { messages as t } from '@/lib/i18n/messages';
import {
  inBounds, longDayLabel, monthGrid, monthLabel, moveDate, type CalendarKey,
} from '@/lib/planner/calendar';
import type { DateBounds } from '@/lib/planner/form';

const WEEKDAYS = [['Su', 'Sunday'], ['Mo', 'Monday'], ['Tu', 'Tuesday'], ['We', 'Wednesday'], ['Th', 'Thursday'], ['Fr', 'Friday'], ['Sa', 'Saturday']];
const KEYS = new Set<string>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/**
 * Pixel date picker following the WAI-ARIA date picker dialog pattern. Only dates inside
 * the forecast horizon can be chosen; arrows, Home/End and PageUp/PageDown move the focus,
 * Enter or Space chooses, Escape closes and focus returns to the button.
 */
export function DatePicker({ bounds, value, onPick }: {
  bounds: DateBounds;
  value: string;
  onPick: (date: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(value && inBounds(value, bounds) ? value : bounds.min);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  const close = (restore = true) => {
    setOpen(false);
    if (restore) buttonRef.current?.focus();
  };

  const toggle = () => {
    if (open) return close();
    setFocused(value && inBounds(value, bounds) ? value : bounds.min);
    setOpen(true);
  };

  const onGridKey = (event: KeyboardEvent) => {
    if (KEYS.has(event.key)) {
      event.preventDefault();
      setFocused(d => moveDate(d, event.key as CalendarKey, bounds));
    }
  };

  const pick = (date: string) => {
    onPick(date);
    setOpen(false);
  };

  const month = monthGrid(focused);
  const canPrev = focused.slice(0, 7) > bounds.min.slice(0, 7);
  const canNext = focused.slice(0, 7) < bounds.max.slice(0, 7);

  return (
    <div className="date-picker">
      <button
        ref={buttonRef}
        type="button"
        className="quick-reply picker-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-dialog` : undefined}
        onClick={toggle}
      >
        <span aria-hidden="true" className="picker-icon" /> {t.picker.open}
      </button>
      {open ? (
        <div
          id={`${id}-dialog`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-month`}
          className="picker-dialog"
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}
        >
          <div className="picker-head">
            <button type="button" className="picker-nav" aria-label={t.picker.previous} disabled={!canPrev}
              onClick={() => setFocused(d => moveDate(d, 'PageUp', bounds))}>‹</button>
            <h3 id={`${id}-month`} aria-live="polite">{monthLabel(focused)}</h3>
            <button type="button" className="picker-nav" aria-label={t.picker.next} disabled={!canNext}
              onClick={() => setFocused(d => moveDate(d, 'PageDown', bounds))}>›</button>
          </div>
          <table ref={gridRef} role="grid" aria-labelledby={`${id}-month`} onKeyDown={onGridKey}>
            <thead>
              <tr>{WEEKDAYS.map(([short, long]) => <th key={long} scope="col" abbr={long}>{short}</th>)}</tr>
            </thead>
            <tbody>
              {month.map((week, i) => (
                <tr key={i}>
                  {week.map((date, j) => {
                    if (!date) return <td key={j} />;
                    const enabled = inBounds(date, bounds);
                    return (
                      <td key={date} aria-selected={date === value ? true : undefined}>
                        <button
                          type="button"
                          data-date={date}
                          tabIndex={date === focused ? 0 : -1}
                          disabled={!enabled}
                          aria-label={enabled ? longDayLabel(date) : `${longDayLabel(date)}, ${t.picker.unavailable}`}
                          aria-current={date === bounds.min ? 'date' : undefined}
                          className={date === value ? 'picked' : undefined}
                          onClick={() => pick(date)}
                          onFocus={() => setFocused(date)}
                        >
                          {Number(date.slice(8))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="picker-hint">{t.picker.hint}</p>
          <button type="button" className="picker-close" onClick={() => close()}>{t.picker.close}</button>
        </div>
      ) : null}
    </div>
  );
}
