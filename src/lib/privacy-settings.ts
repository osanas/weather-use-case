/**
 * Facts shown in the privacy notice that depend on the actual deployment. They must match
 * the production configuration (WEA-10, PRIV-01). A value that is not known yet is written as
 * a "TO COMPLETE" placeholder in square brackets; `npm run check:release` fails while one remains.
 */
export const PRIVACY_SETTINGS = {
  /** Who operates the public deployment. Shown publicly. */
  operator: 'AN45 Labs',
  /** Public contact for privacy questions and requests. Shown publicly. */
  contact: 'anas@an45.co',
  /** Vercel Functions region actually used (for example yul1, Montréal). */
  functionRegion: 'yul1 (Montréal, Canada)',
  /** AI provider enabled in production (`Groq` or `Google Gemini`), matching `AI_PROVIDER`. */
  aiProvider: 'Groq',
  /** Data retention setting of that provider for the production API key. */
  aiRetention: "Groq's default account settings, not changed for this demo (see console.groq.com/docs/your-data)",
  /** The same retention fact in French; update both together. */
  aiRetentionFr: 'réglages de compte par défaut de Groq, non modifiés pour cette démo (voir console.groq.com/docs/your-data)',
  /** Date this notice was last checked against the deployment, YYYY-MM-DD. */
  lastReviewed: '2026-11-24',
} as const;
