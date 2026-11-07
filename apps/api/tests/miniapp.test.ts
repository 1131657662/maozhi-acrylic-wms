import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fixture } from './fixture.ts';
const require = createRequire(import.meta.url);
const miniApi = require('../../miniapp/utils/api.js');

test('真实小程序请求模块与后端登录、列表、详情契约一致', async () => {
  const { app, dispose } = await fixture();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  let token = '';
  Object.assign(globalThis, {
    wx: {
      getStorageSync: () => token,
      request: (options: {
        url: string;
        method: string;
        data: unknown;
        header: Record<string, string>;
        success: (result: unknown) => void;
        fail: () => void;
      }) => {
        const path = new URL(options.url);
        void fetch(`http://127.0.0.1:${address.port}${path.pathname}${path.search}`, {
          method: options.method,
          headers: options.header,
          ...(options.data ? { body: JSON.stringify(options.data) } : {}),
        })
          .then(async (response) => options.success({ statusCode: response.status, data: await response.json() }))
          .catch(options.fail);
      },
    },
  });
  try {
    const auth = await miniApi.login('owner', 'test-only-password');
    token = auth.token;
    assert.equal(auth.channel, 'miniapp');
    const list = await miniApi.listOrders({ page: 1, keyword: 'DEMO-OUT' });
    assert.equal(list.total, 3);
    assert.equal(list.items[0].plannedWeightGrams, 600000);
    const detail = await miniApi.getOrder('DEMO-001');
    assert.equal(detail.customerName, '合成客户 1');
    assert.equal(detail.lines[0].plannedPackages, 2);
    await miniApi.logout();
  } finally {
    Reflect.deleteProperty(globalThis, 'wx');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await dispose();
  }
});
