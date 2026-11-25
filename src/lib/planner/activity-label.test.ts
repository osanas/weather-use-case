import { describe, expect, it } from 'vitest';
import { parseActivityLabel } from './activity-label';

describe('parseActivityLabel', () => {
  it('accepts names with accents, digits and simple punctuation, normalised', () => {
    expect(parseActivityLabel('  Promener   le chien ')).toEqual({ ok: true, label: 'Promener le chien' });
    expect(parseActivityLabel('Pique-nique au parc')).toEqual({ ok: true, label: 'Pique-nique au parc' });
    expect(parseActivityLabel('Rock & roll 5 km.')).toEqual({ ok: true, label: 'Rock & roll 5 km.' });
    expect(parseActivityLabel('Kid’s soccer')).toEqual({ ok: true, label: 'Kid’s soccer' });
    // Decomposed accents are recomposed.
    expect(parseActivityLabel('Café terrasse')).toEqual({ ok: true, label: 'Café terrasse' });
  });

  it('checks the length after trimming, at both bounds', () => {
    expect(parseActivityLabel(' a ').ok).toBe(false);
    expect(parseActivityLabel('ab')).toEqual({ ok: true, label: 'ab' });
    expect(parseActivityLabel('a'.repeat(40)).ok).toBe(true);
    expect(parseActivityLabel('a'.repeat(41))).toEqual({ ok: false, message: 'Keep it to 40 characters or fewer.' });
    expect(parseActivityLabel('')).toEqual({ ok: false, message: 'Type at least 2 characters.' });
  });

  it('rejects markup, symbols, emoji, control characters and labels without a letter', () => {
    for (const raw of ['<script>alert(1)</script>', 'run 🏃', 'a\u0000b', 'tab​zero', 'https://x.io', '{{x}}', '12 34', '--']) {
      expect(parseActivityLabel(raw)).toEqual({ ok: false, message: 'Use letters, numbers, spaces and simple punctuation only.' });
    }
  });
});
