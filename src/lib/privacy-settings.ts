/**
 * Facts shown in the privacy notice that depend on the actual deployment. They must match
 * the production configuration (WEA-10, PRIV-01). Values marked `[TO COMPLETE …]` are not
 * known yet; `npm run check:release` fails while any marker remains.
 */
export const PRIVACY_SETTINGS = {
  /** Who operates the public deployment. Shown publicly. */
  operator: '[TO COMPLETE: operator name]',
  /** Public contact for privacy questions and requests. Shown publicly. */
  contact: '[TO COMPLETE: privacy contact email]',
  /** Vercel Functions region actually used (for example yul1, Montréal). */
  functionRegion: '[TO COMPLETE: Vercel function region]',
  /** Groq data retention setting for the production API key. */
  groqRetention: '[TO COMPLETE: Groq data retention setting]',
  /** Date this notice was last checked against the deployment, YYYY-MM-DD. */
  lastReviewed: '[TO COMPLETE: review date]',
} as const;

export const TO_COMPLETE_MARKER = '[TO COMPLETE';
