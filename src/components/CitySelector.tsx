'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { cityDisplayName, type City } from '@/lib/cities';
import { searchCities } from '@/lib/city-search';

type Props = {
  cities: readonly City[];
  selectedId: string;
  onSelect: (cityId: string) => void;
};

/**
 * ARIA 1.2 combobox with a listbox popup. Search runs locally; keystrokes never
 * leave the browser. Only a confirmed selection calls `onSelect`.
 */
export function CitySelector({ cities, selectedId, onSelect }: Props) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const selected = cities.find(c => c.id === selectedId);
  const selectedLabel = selected ? cityDisplayName(selected) : '';

  const [query, setQuery] = useState(selectedLabel);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const results = useMemo(() => searchCities(editing ? query : '', cities), [editing, query, cities]);
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
    setQuery(cityDisplayName(city));
    if (city.id !== selectedId) onSelect(city.id);
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
      <label htmlFor={inputId}>City</label>
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
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setEditing(true);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={event => event.target.select()}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={close}
      />
      <ul id={listId} role="listbox" aria-label="Cities" hidden={!expanded}>
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
            {cityDisplayName(city)}
          </li>
        ))}
      </ul>
      <p role="status" className="search-status">
        {open && editing && results.length === 0 ? 'No matching cities' : ''}
      </p>
    </div>
  );
}
