import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL, browserName: 'chromium', timezoneId: 'America/Toronto' },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3100',
    url: baseURL,
    reuseExistingServer: false,
    env: { AI_ENABLED: 'false' },
    timeout: 60_000,
  },
});
