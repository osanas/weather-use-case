import type { GuideMood } from '@/lib/planner/conversation';
import { createGrid, parseArt, stamp, type Grid } from './pixels';
import type { Scene } from './scene';

/**
 * Pico, the app's own pixel-art raccoon from Mont Royal, wearing a pompom tuque. Each pose
 * is composed from a base sprite, the parts for a mood and the accessories for the current
 * Montréal scene. Colours come from `px-pico-*` CSS classes.
 */

export const PICO_SIZE = 40;

const LEGEND: Readonly<Record<string, string>> = {
  o: 'pico-line', f: 'pico-fur', m: 'pico-mask', w: 'pico-cream', n: 'pico-nose',
  t: 'pico-tuque', T: 'pico-tuque-lo', b: 'pico-band', B: 'pico-band-lo', p: 'pico-pom', P: 'pico-pom-lo',
  e: 'pico-eye', s: 'pico-shine', k: 'pico-cheek', u: 'pico-line', a: 'pico-mask', i: 'pico-cheek',
  g: 'pico-glasses', G: 'pico-glasses-hi', c: 'pico-umbrella', C: 'pico-umbrella-lo', h: 'pico-handle',
  x: 'pico-scarf', X: 'pico-scarf-lo', l: 'pico-line', L: 'pico-glow', z: 'pico-line',
};

const BASE = [
  '..................pp',
  '.................pppP',
  '.................pPPP',
  '................ooPPoo',
  '..............oottttTToo',
  '.............otttttttTTTo',
  '............ottttttttttTTo',
  '...........otttttttttttTTTo',
  '...........obbbbbbbbbbbbbbo',
  '..........obBbbBbbBbbBbbBbbo',
  '..........offffffffffffffffo',
  '.........offffffffffffffffffo',
  '.........ofmmmmmffffffmmmmmfo',
  '.........ommmmmmmffffmmmmmmmo',
  '.........ommmmmmmwwwwmmmmmmmo',
  '.........offmmmmwwwwwwmmmmffo',
  '.........offfffwwwnnwwwfffffo',
  '..........offfwwwwnnwwwwfffo',
  '..........offfwwwwwwwwwwfffo',
  '...........offfwwwwwwwwfffo',
  '............oofffffffffoo',
  '..............ooooooooo',
  '.............offfffffffo',
  '...ooo......offfwwwwwfffo',
  '..offfo....offfwwwwwwwfffo',
  '.ommmmmo...offwwwwwwwwwffo',
  '.offffffo..offwwwwwwwwwffo',
  'ommmmmmmmo.offwwwwwwwwwffo',
  'offffffffoooffwwwwwwwwwffo',
  'ommmmmmmmmoffffwwwwwwwfffo',
  '.offfffffffofffffffffffffo',
  '..ommmmmmmmoffffffffffffo',
  '...ooooooooooffffffffffo',
  '............offfo..offfo',
  '............ommmo..ommmo',
  '.............ooo....ooo',
];

const PARTS = {
  'ears-up': [
    { x: 8, y: 7, rows: ['.oo.', 'oaio', 'oaao', '.oo.'] },
    { x: 26, y: 7, rows: ['.oo.', 'oiao', 'oaao', '.oo.'] }],
  'ears-down': [
    { x: 6, y: 11, rows: ['.ooo', 'oaao', 'oaio', '.oo.'] },
    { x: 28, y: 11, rows: ['ooo.', 'oaao', 'oiao', '.oo.'] }],
  'eyes-open': [
    { x: 13, y: 13, rows: ['ee', 'es'] },
    { x: 23, y: 13, rows: ['ee', 'es'] }],
  'eyes-happy': [
    { x: 12, y: 13, rows: ['.e.', 'e.e'] },
    { x: 22, y: 13, rows: ['.e.', 'e.e'] }],
  'eyes-sleepy': [
    { x: 12, y: 14, rows: ['eee'] },
    { x: 22, y: 14, rows: ['eee'] }],
  'cheeks': [
    { x: 11, y: 17, rows: ['kk'] },
    { x: 26, y: 17, rows: ['kk'] }],
  'mouth-smile': [
    { x: 17, y: 18, rows: ['u..u', '.uu.'] }],
  'mouth-open': [
    { x: 17, y: 18, rows: ['uuuu', '.kk.'] }],
  'mouth-flat': [
    { x: 18, y: 18, rows: ['uuu'] }],
  'mouth-wavy': [
    { x: 17, y: 18, rows: ['.u.u', 'u.u.'] }],
  'arm-left-down': [
    { x: 9, y: 24, rows: ['oo', 'ofo', 'ofo', 'ofo', 'omo', '.o.'] }],
  'arm-right-down': [
    { x: 25, y: 24, rows: ['.oo', 'ofo', 'ofo', 'ofo', 'omo', '.o.'] }],
  'arm-right-up': [
    { x: 25, y: 13, rows: ['......oo', '.....omo', '.....ofo', '....offo', '....ofo.', '...offo.', '...ofo..', '..offo..', '.offo...', 'offo....', 'oo......'] }],
  'arm-right-wave': [
    { x: 25, y: 15, rows: ['.......oo', '......omo', '.....offo', '....offo.', '...offo..', '..offo...', '.offo....', 'offo.....', 'oo.......'] }],
  'arm-right-chin': [
    { x: 18, y: 18, rows: ['.oo...', 'omfo..', 'offfo.', '.offfo', '..offo', '...ofo', '....oo'] }],
  'dots': [
    { x: 31, y: 4, rows: ['.....zz', '.....zz', '..z....', '.......', 'z......'] }],
  'dots-small': [
    { x: 31, y: 6, rows: ['..z....', '.......', 'z......'] }],
  'sunglasses': [
    { x: 10, y: 13, rows: ['ggggggggggggggggggg', '.gGGgg.......ggGGg.', '..ggg.........ggg..'] }],
  'scarf': [
    { x: 12, y: 21, rows: ['xxxxxxxxxxxxx', 'XxxxxxxxxxxxX', '..........xx.', '..........xX.', '..........XX.'] }],
  'umbrella': [
    { x: 22, y: 0, rows: ['......cccccc......', '...cccccccccccc...', '.cccccccccccccccc.', 'cccccccccccccccccc', 'CCcCCCcCCCcCCCcCCC'] },
    { x: 31, y: 5, rows: ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'] }],
  'lantern': [
    { x: 6, y: 29, rows: ['..o..', '.ooo.', 'olLlo', 'oLLLo', 'olLlo', '.ooo.'] },
    { x: 9, y: 29, rows: ['oo'] }],
} as const satisfies Record<string, readonly { x: number; y: number; rows: readonly string[] }[]>;

type Part = keyof typeof PARTS;

/** What Pico wears for a scene. A `null` scene (stale, failed or unknown weather) means none of it. */
export type PicoOutfit = {
  sunglasses: boolean;
  umbrella: boolean;
  shaking: boolean;
  scarf: boolean;
  lantern: boolean;
  sleepy: boolean;
};

const OUTFIT_KEYS = ['sunglasses', 'umbrella', 'shaking', 'scarf', 'lantern', 'sleepy'] as const;

export function picoOutfit(scene: Scene | null): PicoOutfit {
  const wet = scene?.sky === 'rain' || scene?.sky === 'storm';
  const night = scene?.night === true;
  return {
    sunglasses: scene?.sky === 'clear' && !night,
    umbrella: wet,
    shaking: scene?.sky === 'storm',
    scarf: scene?.sky === 'snow' || scene?.cold === true,
    lantern: night,
    sleepy: night,
  };
}

/** Space-separated list of what Pico wears, or `none`. Used as a data attribute and cache key. */
export function outfitKey(outfit: PicoOutfit): string {
  return OUTFIT_KEYS.filter(k => outfit[k]).join(' ') || 'none';
}

const pad = (rows: readonly string[]) => {
  const width = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.padEnd(width, '.'));
};

const partGrids = new Map<Part, { x: number; y: number; art: Grid }[]>();

function partArt(part: Part) {
  let pieces = partGrids.get(part);
  if (!pieces) {
    pieces = PARTS[part].map(({ x, y, rows }) => ({ x, y, art: parseArt(pad(rows), LEGEND) }));
    partGrids.set(part, pieces);
  }
  return pieces;
}

const BASE_ART = parseArt(pad(BASE.map(r => r.padEnd(PICO_SIZE, '.'))), LEGEND);

function compose(parts: readonly Part[]): Grid {
  const grid = createGrid(PICO_SIZE, PICO_SIZE);
  stamp(grid, BASE_ART, 0, 0);
  for (const part of parts) for (const { x, y, art } of partArt(part)) stamp(grid, art, x, y);
  return grid;
}

/** The parts of each animation frame, in drawing order. */
export function picoParts(mood: GuideMood, outfit: PicoOutfit): Part[][] {
  const eyes: Part = mood === 'happy' ? 'eyes-happy' : outfit.sleepy ? 'eyes-sleepy' : 'eyes-open';
  const ears: Part = mood === 'unsure' ? 'ears-down' : 'ears-up';
  const mouth: Part = { hello: 'mouth-smile', happy: 'mouth-open', thinking: 'mouth-flat', unsure: 'mouth-wavy' }[mood] as Part;
  const face: Part[] = [ears, eyes, mouth, ...(mood === 'hello' || mood === 'happy' ? ['cheeks' as const] : [])];

  // The umbrella needs the raised right arm, so it replaces the mood's right arm.
  const rightArms: Part[] = outfit.umbrella ? ['arm-right-up']
    : mood === 'hello' ? ['arm-right-up', 'arm-right-wave']
      : mood === 'happy' ? ['arm-right-up']
        : mood === 'thinking' ? ['arm-right-chin']
          : ['arm-right-down'];
  const dots: Part[][] = mood === 'thinking' ? [['dots'], ['dots-small']] : [[]];
  const wear: Part[] = [
    ...(outfit.scarf ? ['scarf' as const] : []),
    ...(outfit.sunglasses ? ['sunglasses' as const] : []),
    ...(outfit.lantern ? ['lantern' as const] : []),
    ...(outfit.umbrella ? ['umbrella' as const] : []),
  ];

  const frames = Math.max(rightArms.length, dots.length);
  return Array.from({ length: frames }, (_, i) => [
    ...face, 'arm-left-down', rightArms[i % rightArms.length]!, ...dots[i % dots.length]!, ...wear,
  ]);
}

const frameCache = new Map<string, Grid[]>();

/** One or two frames for a mood and outfit; two frames alternate while motion is allowed. */
export function picoFrames(mood: GuideMood, outfit: PicoOutfit): Grid[] {
  const key = `${mood}|${outfitKey(outfit)}`;
  let frames = frameCache.get(key);
  if (!frames) {
    frames = picoParts(mood, outfit).map(compose);
    frameCache.set(key, frames);
  }
  return frames;
}
