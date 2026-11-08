import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /catalog-.*\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  outputDir: '.local/catalog-test-results',
  use: {
    baseURL: 'http://127.0.0.1:5175',
    headless: true,
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx cross-env UMI_ENV=test MOCK=none PORT=5175 HOST=127.0.0.1 max dev',
    cwd: './apps/web',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    env: { API_TARGET: 'http://127.0.0.1:4312' },
  },
});
