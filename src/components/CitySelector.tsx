'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { loadCatalogue } from '@/lib/catalogue-client';
import { cityDisplayName, type City } from '@/lib/cities';
import { searchCities } from '@/lib/city-search';
import { useLocale, useMessages } from './Language';

/** Suggestions shown at once; the full catalogue has about 8,900 cities. */
const MAX_RESULTS = 8;

type Props = {
  /** Featured cities: shown for an empty query and searched until the full catalogue loads. */
  cities: readonly City[];
  /** The selected city, or `null` for none (the chat's "Other city" search). */
  selected: City | null;
  onSelect: (city: City) => void;
  /** Visible label; the page's main selector is "City" in the interface language. */
  label?: string;
};

/**
 * ARIA 1.2 combobox with a listbox popup. The Canada and United States catalogue is fetched
 * once on first focus and searched locally; keystrokes never leave the browser. Only a
 * confirmed selection calls `onSelect`.
 */
export function CitySelector({ cities, selected, onSelect, label }: Props) {
  const locale = useLocale();
  const t = useMessages();
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const selectedLabel = selected ? cityDisplayName(selected, locale) : '';
  const [catalogue, setCatalogue] = useState<City[] | null>(null);
  const [loading, setLoading] = useState<'idle' | 'loading' | 'failed'>('idle');

  function load() {
    if (catalogue || loading === 'loading') return;
    setLoading('loading');
    loadCatalogue().then(
      all => { setCatalogue(all); setLoading('idle'); },
      () => setLoading('failed'),
    );
  }

  const [query, setQuery] = useState(selectedLabel);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const results = useMemo(() => {
    const q = editing ? query : '';
    return searchCities(q, q.trim() && catalogue ? catalogue : cities, MAX_RESULTS);
  }, [editing, query, cities, catalogue]);
  const expanded = open && results.length > 0;

  function close() {
    setOpen(false);
    setActive(-1);
    setEditing(false);
    setQuery(selectedLabel);
  }

  function choose(city: City) {
    setOpen(false);
    setActive(-1);
    setEditing(false);
    setQuery(cityDisplayName(city, locale));
    if (city.id !== selected?.id) onSelect(city);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActive(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setOpen(true);
        setActive(i => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        const city = expanded && active >= 0 ? results[active] : undefined;
        if (city) {
          event.preventDefault();
          choose(city);
        }
        break;
      }
      case 'Escape':
        if (open || editing) {
          event.preventDefault();
          close();
        }
        break;
    }
  }

  return (
    <div className="city-selector">
      <label htmlFor={inputId}>{label ?? t.city.label}</label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={editing ? query : selectedLabel}
        onChange={event => {
          setQuery(event.target.value);
          setEditing(true);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={event => { event.target.select(); load(); }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={close}
      />
      <ul id={listId} role="listbox" aria-label={t.city.list} hidden={!expanded}>
        {expanded && results.map((city, i) => (
          <li
            key={city.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            className={i === active ? 'active' : undefined}
            // Keep focus in the input so blur does not close the list before the click lands.
            onMouseDown={event => event.preventDefault()}
            onClick={() => choose(city)}
          >
            {cityDisplayName(city, locale)}
          </li>
        ))}
      </ul>
      <p role="status" className="search-status">
        {!open || !editing ? ''
          : loading === 'loading' && !catalogue ? t.city.loading
            : loading === 'failed' ? t.city.failed
              : results.length === 0 ? t.city.none : ''}
      </p>
    </div>
  );
}
