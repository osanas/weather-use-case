import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from './security-headers';

const header = (key: string) => SECURITY_HEADERS.find(h => h.key === key)?.value;

describe('security headers', () => {
  it('blocks framing, sniffing and unused browser features', () => {
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Permissions-Policy')).toContain('geolocation=()');
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });

  it('applies the headers to every route through next.config', async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: '/:path*', headers: [...SECURITY_HEADERS] }]);
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
