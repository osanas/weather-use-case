/**
 * The name a visitor types for their own activity. It is a display label only: it stays in
 * the browser and is never sent to the server, the weather provider or the AI. The plan is
 * requested with the `other` profile instead (WEA-21, PRIV-01).
 *
 * Accepted: letters (any script, with accents), digits, spaces and ' ’ - . &, 2–40 characters
 * after trimming and collapsing spaces. Control characters, symbols and emoji are rejected,
 * and React renders the label as text only.
 */
export const ACTIVITY_LABEL_MIN = 2;
export const ACTIVITY_LABEL_MAX = 40;

const ALLOWED = /^[\p{L}\p{M}\p{N} '’\-.&]+$/u;
const HAS_LETTER = /\p{L}/u;

export type ActivityLabelResult = { ok: true; label: string } | { ok: false; message: string };

export function parseActivityLabel(raw: string): ActivityLabelResult {
  const label = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (label.length < ACTIVITY_LABEL_MIN) {
    return { ok: false, message: `Type at least ${ACTIVITY_LABEL_MIN} characters.` };
  }
  if (label.length > ACTIVITY_LABEL_MAX) {
    return { ok: false, message: `Keep it to ${ACTIVITY_LABEL_MAX} characters or fewer.` };
  }
  if (!ALLOWED.test(label) || !HAS_LETTER.test(label)) {
    return { ok: false, message: 'Use letters, numbers, spaces and simple punctuation only.' };
  }
  return { ok: true, label };
}
