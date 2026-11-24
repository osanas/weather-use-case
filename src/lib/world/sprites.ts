import { parseArt, seededRandom, type Grid } from './pixels';

/** Small original sprites for the sky. Colours come from CSS classes. */

export const SUN: Grid = parseArt([
  '......r.r......',
  '..r....r....r..',
  '...r.......r...',
  '.....ooooo.....',
  '....oyyyyyo....',
  'r..oyyyyyyyo..r',
  '.r.oyyyyyyyo.r.',
  '...oyyyhyyyo...',
  '.r.oyyyyyyyo.r.',
  'r..oyyyyyyyo..r',
  '....oyyyyyo....',
  '.....ooooo.....',
  '...r.......r...',
  '..r....r....r..',
  '......r.r......',
], { r: 'sun-ray', o: 'sun-rim', y: 'sun', h: 'sun-hi' });

export const MOON: Grid = parseArt([
  '....mmmm...',
  '..mmmmm....',
  '.mmmmm.....',
  '.mmmmc.....',
  'mmmmm......',
  'mmmmm......',
  'mmmmm......',
  '.mmmmm....m',
  '.mmmmmm..mm',
  '..mmmmmmmm.',
  '....mmmm...',
], { m: 'moon', c: 'moon-crater' });

export const CLOUD_LARGE: Grid = parseArt([
  '.........wwww...........',
  '.......wwwwwwww.........',
  '...www.wwwwwwwww.www....',
  '..wwwwwwwwwwwwwwwwwwww..',
  '.wwwwwwwwwwwwwwwwwwwwww.',
  'wwwwwwwwwwwwwwwwwwwwwwww',
  'ssssssssssssssssssssssss',
  '.ssssssssssssssssssssss.',
], { w: 'cloud', s: 'cloud-shade' });

export const CLOUD_SMALL: Grid = parseArt([
  '....wwww....',
  '..wwwwwwww..',
  '.wwwwwwwwwww',
  'wwwwwwwwwwww',
  '.ssssssssss.',
], { w: 'cloud', s: 'cloud-shade' });

export type Star = { x: number; y: number; big: boolean; twinkle: 0 | 1 | 2 };

export const STAR_FIELD = { width: 240, height: 120 } as const;

/** Fixed star field, so the night sky is the same on every visit. */
export const STARS: readonly Star[] = (() => {
  const rnd = seededRandom(45);
  return Array.from({ length: 70 }, () => ({
    x: Math.floor(rnd() * STAR_FIELD.width),
    y: Math.floor(rnd() * STAR_FIELD.height),
    big: rnd() < 0.12,
    twinkle: Math.floor(rnd() * 3) as 0 | 1 | 2,
  }));
})();
