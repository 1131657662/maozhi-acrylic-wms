import { test as base, type BrowserContext } from '@playwright/test';
import { login } from '../../apps/api/src/features/auth/service';
import { e2eDatabase } from './inventory-helpers';

type ListSession = Awaited<ReturnType<BrowserContext['storageState']>>;

// List tests exercise authenticated reads. Login UI/rate limits remain covered by their own tests.
export const test = base.extend<{}, { listSession: ListSession }>({
  listSession: [
    async ({}, use) => {
      const db = e2eDatabase(); // Rejects every database except the random, disposable test database.
      try {
        const session = await login(
          db,
          { username: 'owner', password: 'e2e-only-password', channel: 'web' },
          { username: 'owner', traceId: 'list-e2e-session' },
        );
        await use({
          cookies: [
            {
              name: 'wms_session',
              value: session.token,
              domain: '127.0.0.1',
              path: '/api',
              expires: -1,
              httpOnly: true,
              secure: false,
              sameSite: 'Strict',
            },
          ],
          origins: [],
        });
      } finally {
        await db.close();
      }
    },
    { scope: 'worker' },
  ],
  storageState: async ({ listSession }, use) => use(listSession),
});
