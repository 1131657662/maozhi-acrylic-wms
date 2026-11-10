import { once } from 'node:events';
import { resolve } from 'node:path';
import express from 'express';
import { chromium } from '@playwright/test';
import type { Database } from '../../apps/api/src/db/mysql.ts';
import { createApp } from '../../apps/api/src/app.ts';
import { probeHttp } from './probe.ts';

export async function browserRuntime(db: Database) {
  const app = express();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Invalid local port');
  const origin = 'http://127.0.0.1:' + address.port;
  app.use(probeHttp);
  const api = createApp(db, [origin]);
  app.use((req, res, next) => (req.path.startsWith('/api/') ? api(req, res, next) : next()));
  const browser = await chromium.launch();
  app.use(express.static(resolve('apps/web/dist')));
  app.use((_req, res) => res.sendFile(resolve('apps/web/dist/index.html')));
  const auth = await browser.newContext();
  const login = await auth.request.post(origin + '/api/v1/auth/login', {
    data: { username: 'owner', password: 'perf-only-password', channel: 'web' },
    headers: { Origin: origin },
  });
  if (!login.ok()) throw new Error('Performance login failed: ' + login.status());
  const storageState = await auth.storageState();
  await auth.close();
  const close = async () => {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  };
  return { browser, origin, storageState, close };
}
