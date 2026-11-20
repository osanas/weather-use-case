/**
 * Response headers applied to every route (deployment spec, perimeter step 2).
 *
 * The CSP is deliberately minimal: it blocks framing, plugins, base-URI and form-target
 * changes without restricting scripts, because Next.js injects inline scripts that would
 * need a nonce. A stricter script policy must be tested on the actual deployment first.
 * Vercel adds HSTS on production domains; it is also set here for other HTTPS hosts.
 */
export const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];
