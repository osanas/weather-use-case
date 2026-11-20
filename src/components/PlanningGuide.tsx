'use client';

import type { GuideMood, GuidePrompt } from '@/lib/planner/guide';

const MOUTHS: Record<GuideMood, string> = {
  hello: 'M41 47 Q48 53 55 47',
  happy: 'M39 45 Q48 57 57 45 Z',
  thinking: 'M44 49 L52 49',
  unsure: 'M41 50 Q48 46 55 50',
};

/** Cirrus, the app's own cloud character. Decorative: the bubble carries the message. */
function Cirrus({ mood }: { mood: GuideMood }) {
  return (
    <svg className="guide-character" viewBox="0 0 96 72" width="96" height="72" aria-hidden="true" focusable="false">
      <path
        className="guide-cloud"
        d="M22 62 C8 62 4 46 16 41 C14 27 30 20 38 28 C42 14 64 12 70 27 C84 24 94 38 86 48 C94 56 86 64 76 62 Z"
      />
      <circle className="guide-cheek" cx="32" cy="46" r="4" />
      <circle className="guide-cheek" cx="64" cy="46" r="4" />
      <circle className="guide-eye" cx="39" cy="38" r="3" />
      <circle className="guide-eye" cx="57" cy="38" r="3" />
      <path className={mood === 'happy' ? 'guide-mouth guide-mouth-open' : 'guide-mouth'} d={MOUTHS[mood]} />
      {mood === 'thinking'
        ? <g className="guide-dots"><circle cx="78" cy="14" r="2" /><circle cx="85" cy="9" r="2.5" /><circle cx="93" cy="4" r="3" /></g>
        : null}
    </svg>
  );
}

/**
 * Planning guide shown beside the form. It reads the prompt chosen from the form state and
 * has nothing focusable, so it never takes focus or changes a value. The message is a polite
 * live region only for guidance steps; field errors and results announce themselves.
 */
export function PlanningGuide({ prompt }: { prompt: GuidePrompt }) {
  return (
    <aside className="planning-guide" aria-label="Planning guide" data-step={prompt.step}>
      <Cirrus mood={prompt.mood} />
      <p className="guide-bubble" aria-live={prompt.announce ? 'polite' : 'off'} aria-atomic="true">
        {prompt.text}
      </p>
    </aside>
  );
}
