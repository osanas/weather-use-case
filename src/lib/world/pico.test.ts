import { describe, expect, it } from 'vitest';
import type { GuideMood } from '@/lib/planner/conversation';
import { gridRuns } from './pixels';
import { outfitKey, PICO_SIZE, picoFrames, picoOutfit, picoParts, type PicoOutfit } from './pico';
import type { Scene } from './scene';

const scene = (overrides: Partial<Scene> = {}): Scene => ({ sky: 'clear', night: false, cold: false, ...overrides });
const NONE = picoOutfit(null);
const MOODS: GuideMood[] = ['hello', 'happy', 'thinking', 'unsure'];

describe('picoOutfit', () => {
  it('wears nothing when the scene is neutral', () => {
    expect(outfitKey(NONE)).toBe('none');
    expect(Object.values(NONE).every(v => v === false)).toBe(true);
  });

  it('follows the Montréal scene', () => {
    expect(outfitKey(picoOutfit(scene()))).toBe('sunglasses');
    expect(outfitKey(picoOutfit(scene({ sky: 'cloudy' })))).toBe('none');
    expect(outfitKey(picoOutfit(scene({ sky: 'fog' })))).toBe('none');
    expect(outfitKey(picoOutfit(scene({ sky: 'rain' })))).toBe('umbrella');
    expect(outfitKey(picoOutfit(scene({ sky: 'storm' })))).toBe('umbrella shaking');
    expect(outfitKey(picoOutfit(scene({ sky: 'snow' })))).toBe('scarf');
  });

  it('adds the scarf at or below freezing and the lantern at night, without sunglasses', () => {
    expect(outfitKey(picoOutfit(scene({ sky: 'cloudy', cold: true })))).toBe('scarf');
    expect(outfitKey(picoOutfit(scene({ night: true })))).toBe('lantern sleepy');
    expect(outfitKey(picoOutfit(scene({ sky: 'snow', night: true, cold: true })))).toBe('scarf lantern sleepy');
  });
});

describe('picoFrames', () => {
  const outfits: PicoOutfit[] = [
    NONE, picoOutfit(scene()), picoOutfit(scene({ sky: 'storm', night: true })),
    picoOutfit(scene({ sky: 'snow', cold: true })),
  ];

  it('draws every pose on the full sprite canvas', () => {
    for (const mood of MOODS) {
      for (const outfit of outfits) {
        for (const frame of picoFrames(mood, outfit)) {
          expect(frame).toHaveLength(PICO_SIZE);
          expect(frame.every(row => row.length === PICO_SIZE)).toBe(true);
          expect(gridRuns(frame).every(run => run.cls.startsWith('pico-'))).toBe(true);
        }
      }
    }
  });

  it('gives each mood its own look', () => {
    const looks = MOODS.map(mood => JSON.stringify(picoFrames(mood, NONE)[0]));
    expect(new Set(looks).size).toBe(MOODS.length);
  });

  it('waves and thinks in two frames, and holds still otherwise', () => {
    expect(picoFrames('hello', NONE)).toHaveLength(2);
    expect(picoFrames('thinking', NONE)).toHaveLength(2);
    expect(picoFrames('happy', NONE)).toHaveLength(1);
    expect(picoFrames('unsure', NONE)).toHaveLength(1);
  });

  it('holds the umbrella with the raised arm instead of waving', () => {
    const rain = picoOutfit(scene({ sky: 'rain' }));
    for (const mood of MOODS) {
      for (const parts of picoParts(mood, rain)) {
        expect(parts).toContain('umbrella');
        expect(parts).toContain('arm-right-up');
        expect(parts).not.toContain('arm-right-wave');
        expect(parts).not.toContain('arm-right-chin');
      }
    }
  });

  it('keeps happy eyes at night and sleepy eyes otherwise', () => {
    const night = picoOutfit(scene({ night: true }));
    expect(picoParts('happy', night)[0]).toContain('eyes-happy');
    expect(picoParts('hello', night)[0]).toContain('eyes-sleepy');
    expect(picoParts('unsure', night)[0]).toEqual(expect.arrayContaining(['ears-down', 'lantern']));
  });

  it('returns the same frames for the same pose', () => {
    expect(picoFrames('hello', NONE)).toBe(picoFrames('hello', picoOutfit(null)));
  });
});
