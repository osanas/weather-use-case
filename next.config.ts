import type { NextConfig } from 'next';

// Security headers and CSP are handled by the hardening ticket (SEC-01/SEC-02).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
