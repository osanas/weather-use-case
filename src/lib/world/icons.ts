import { createGrid, parseArt, stamp, type Grid } from './pixels';

/**
 * Original 16×16 weather icons for the forecast tiles and day cards, one per WMO code
 * group. Parts are drawn once as ASCII art and composed. Classes are `icon-*` (rendered
 * as `px-icon-*`) with their own colours in forecast.css, so icons stay readable on the
 * glass cards whatever the backdrop scene.
 */
export type IconKind =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezing'
  | 'rain'
  | 'showers'
  | 'snow'
  | 'snow-showers'
  | 'thunderstorm'
  | 'hail'
  | 'unknown';

export const ICON_SIZE = 16;

const KIND_BY_CODE: Readonly<Record<number, IconKind>> = {
  0: 'clear', 1: 'clear',
  2: 'partly-cloudy',
  3: 'overcast',
  45: 'fog', 48: 'fog',
  51: 'drizzle', 53: 'drizzle', 55: 'drizzle',
  56: 'freezing', 57: 'freezing', 66: 'freezing', 67: 'freezing',
  61: 'rain', 63: 'rain', 65: 'rain',
  80: 'showers', 81: 'showers', 82: 'showers',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
  85: 'snow-showers', 86: 'snow-showers',
  95: 'thunderstorm',
  96: 'hail', 99: 'hail',
};

/** Icon group for a WMO weather code; missing or unrecognised codes get the `unknown` icon. */
export function iconForCode(code: number | null): IconKind {
  if (code === null) return 'unknown';
  return KIND_BY_CODE[code] ?? 'unknown';
}

const SUN_LEGEND = { r: 'icon-ray', o: 'icon-sun-rim', y: 'icon-sun', h: 'icon-sun-hi' };

const SUN = parseArt([
  '................',
  '.......rr.......',
  '..r....rr....r..',
  '...r........r...',
  '......oooo......',
  '.....oyyyyo.....',
  '....oyyhyyyo....',
  '.rr.oyhyyyyo.rr.',
  '.rr.oyyyyyyo.rr.',
  '....oyyyyyyo....',
  '.....oyyyyo.....',
  '......oooo......',
  '...r........r...',
  '..r....rr....r..',
  '.......rr.......',
  '................',
], SUN_LEGEND);

const SMALL_SUN = parseArt([
  '....r....',
  '.r.....r.',
  '...ooo...',
  '..oyyyo..',
  'r.oyhyo.r',
  '..oyyyo..',
  '...ooo...',
  '.r.....r.',
  '....r....',
], SUN_LEGEND);

const CLOUD_ROWS = [
  '......oooo......',
  '.....owwwwo.....',
  '..ooowwwwwwoo...',
  '.owwwwwwwwwwwo..',
  'owwwwwwwwwwwwwo.',
  'owwwwwwwwwwwwwwo',
  'osssssssssssssso',
  '.oooooooooooooo.',
];
const CLOUD = parseArt(CLOUD_ROWS, { o: 'icon-line', w: 'icon-cloud', s: 'icon-cloud-shade' });
const STORM_CLOUD = parseArt(CLOUD_ROWS, { o: 'icon-line', w: 'icon-storm', s: 'icon-storm-shade' });

const BACK_CLOUD = parseArt([
  '...oooo...',
  '..owwwwo..',
  '.owwwwwwwo',
  'owwwwwwwwo',
  'osssssssso',
  '.oooooooo.',
], { o: 'icon-line', w: 'icon-cloud-back', s: 'icon-cloud-back-shade' });

const DRIZZLE = parseArt([
  '...d......d.....',
  '................',
  '......d......d..',
  '................',
  '..d.......d.....',
  '................',
], { d: 'icon-drop' });

const RAIN = parseArt([
  '...d....d....d..',
  '..d....d....d...',
  '.d....d....d....',
  '................',
  '....d....d......',
  '...d....d.......',
], { d: 'icon-drop' });

const FREEZING = parseArt([
  '...d.......i....',
  '..d.......iii...',
  '...........i....',
  '.....i.....d....',
  '....iii...d.....',
  '.....i..........',
], { d: 'icon-drop', i: 'icon-ice' });

const SNOW = parseArt([
  '..f.......f.....',
  '.fff.....fff....',
  '..f.......f.....',
  '......f.......f.',
  '.....fff.....fff',
  '......f.......f.',
], { f: 'icon-flake' });

const BOLT = parseArt([
  '.......bbb......',
  '......bbb.......',
  '.....bbbbbb.....',
  '.......bbb......',
  '......bb........',
  '.....b..........',
], { b: 'icon-bolt' });

const HAIL = parseArt([
  '.............h..',
  '................',
  '.h..............',
  '.............h..',
  '...h............',
  '............h...',
], { h: 'icon-hail' });

const FOG = parseArt([
  '..ffffffffff....',
  '................',
  '....ffffffffffff',
  '................',
  'ffffffffffff....',
  '................',
  '..ffffffffffff..',
  '................',
  '....ffffffff....',
], { f: 'icon-fog' });

const QUESTION = parseArt([
  '................',
  '................',
  '.....oooooo.....',
  '....oo....oo....',
  '....oo....oo....',
  '..........oo....',
  '.........oo.....',
  '........oo......',
  '.......oo.......',
  '.......oo.......',
  '................',
  '.......oo.......',
  '.......oo.......',
  '................',
  '................',
  '................',
], { o: 'icon-unknown' });

type Part = readonly [Grid, number, number];

function compose(...parts: Part[]): Grid {
  const grid = createGrid(ICON_SIZE, ICON_SIZE);
  for (const [art, x, y] of parts) stamp(grid, art, x, y);
  return grid;
}

// Precipitation icons share a cloud at the top and a six-row strip below it.
const wet = (strip: Grid, cloud: Grid = CLOUD): Grid => compose([cloud, 0, 2], [strip, 0, 10]);

export const ICONS: Readonly<Record<IconKind, Grid>> = {
  clear: SUN,
  'partly-cloudy': compose([SMALL_SUN, 7, 1], [CLOUD, 0, 6]),
  overcast: compose([BACK_CLOUD, 6, 2], [CLOUD, 0, 6]),
  fog: compose([FOG, 0, 3]),
  drizzle: wet(DRIZZLE),
  freezing: wet(FREEZING),
  rain: wet(RAIN),
  showers: compose([SMALL_SUN, 7, 0], [CLOUD, 0, 2], [RAIN, 0, 10]),
  snow: wet(SNOW),
  'snow-showers': compose([SMALL_SUN, 7, 0], [CLOUD, 0, 2], [SNOW, 0, 10]),
  thunderstorm: wet(BOLT, STORM_CLOUD),
  hail: compose([STORM_CLOUD, 0, 2], [BOLT, 0, 10], [HAIL, 0, 10]),
  unknown: QUESTION,
};
