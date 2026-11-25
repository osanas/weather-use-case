'use client';

import type { GuideMood } from '@/lib/planner/conversation';
import { outfitKey, PICO_SIZE, picoFrames, picoOutfit } from '@/lib/world/pico';
import { useWorld } from './world/World';
import { PixelRuns } from './world/PixelArt';

/**
 * Pico, the planning guide's raccoon. Decorative: the speech bubble carries the message.
 * The mood follows the guide step and the outfit follows the live Montréal scene, so Pico
 * wears nothing weather-related while that scene is neutral (stale, failed or unknown data).
 */
export function Companion({ mood, variant = 'full', still = false }: {
  mood: GuideMood;
  /** `avatar` crops to the head for chat bubbles. */
  variant?: 'full' | 'avatar';
  /** Past messages hold still; only the current Pico moves. */
  still?: boolean;
}) {
  const { scene } = useWorld();
  const outfit = picoOutfit(scene);
  const frames = picoFrames(mood, outfit);
  return (
    <svg
      className={`pico pico-${variant}${still ? ' pico-still' : ''}`}
      viewBox={variant === 'avatar' ? '7 0 26 24' : `0 0 ${PICO_SIZE} ${PICO_SIZE}`}
      width={variant === 'avatar' ? 26 : PICO_SIZE}
      height={variant === 'avatar' ? 24 : PICO_SIZE}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
      data-outfit={outfitKey(outfit)}
      data-frames={frames.length}
    >
      <g className="pico-motion">
        {frames.map((frame, i) => <PixelRuns key={i} grid={frame} className={`pico-frame pico-frame-${i}`} />)}
      </g>
    </svg>
  );
}
