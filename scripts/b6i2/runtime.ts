import assert from 'node:assert/strict';
import { once } from 'node:events';
import { resolve } from 'node:path';
import express from 'express';
import { chromium } from '@playwright/test';
import type { Database } from '../../apps/api/src/db/mysql.ts';
import { createApp } from '../../apps/api/src/app.ts';
import { httpProbe } from './telemetry.ts';

export async function runtime(db: Database) {
  const app = express(),
    server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`,
    api = createApp(db, [origin]);
  app.use(httpProbe);
  app.use((req, res, next) => (req.path.startsWith('/api/') ? api(req, res, next) : next()));
  app.use(express.static(resolve('apps/web/dist')));
  app.use((_req, res) => res.sendFile(resolve('apps/web/dist/index.html')));
  const browser = await chromium.launch(),
    auth = await browser.newContext();
  const login = await auth.request.post(origin + '/api/v1/auth/login', {
    data: { username: 'owner', password: 'perf-only-password', channel: 'web' },
    headers: { Origin: origin },
  });
  assert.equal(login.status(), 200);
  const storageState = await auth.storageState();
  await auth.close();
  return {
    browser,
    origin,
    storageState,
    close: async () => {
      await browser.close();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}
export type Runtime = Awaited<ReturnType<typeof runtime>>;
