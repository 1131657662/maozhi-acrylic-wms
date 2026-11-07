import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx scripts/e2e-api.ts',
      url: 'http://127.0.0.1:4311/api/v1/health',
      reuseExistingServer: false,
      env: { LOG_LEVEL: 'silent' },
    },
    {
      command: 'npm run dev:e2e -w @wms/web',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: { API_TARGET: 'http://127.0.0.1:4311' },
    },
  ],
});
