import { test as base, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../../scripts/mysql/test-database';
import { seedDemo } from '../../apps/api/src/db/seed-test';
import { createApp } from '../../apps/api/src/app';
import type { Database } from '../../apps/api/src/db/mysql';

export const test = base.extend<{ catalogDb: Database }>({
  catalogDb: [
    async ({}, use) => {
      const { db, dispose } = await createTestDatabase();
      await seedDemo(db, 'e2e-only-password');
      const server = createApp(db, ['http://127.0.0.1:5175', 'http://127.0.0.1:4312'], true).listen(4312, '127.0.0.1');
      await new Promise<void>((resolve) => server.once('listening', resolve));
      try {
        await use(db);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await dispose();
      }
    },
    { auto: true },
  ],
});
export { expect };
export async function loginCatalog(page: Page) {
  await page.goto('/user/login');
  await page.getByLabel('用户名', { exact: true }).fill('owner');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page.getByRole('heading', { name: '出库工作台' })).toBeVisible();
  await page.goto('/catalog');
  await expect(page.getByText('服务端当前目录', { exact: true })).toBeVisible();
  await page.getByLabel('文件编码', { exact: true }).click();
  await page.getByTitle('UTF-8', { exact: true }).click();
}
export async function uploadFile(page: Page, content: string) {
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'sku.txt', mimeType: 'text/plain', buffer: Buffer.from(content) });
  await page.getByRole('button', { name: '上传并校验' }).click();
}
export async function publishFile(page: Page) {
  await page.getByRole('button', { name: '发布整版', exact: true }).click();
  await page.getByRole('button', { name: '确认发布整版', exact: true }).click();
}
export async function catalogShot(page: Page, name: string) {
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({
      path: `.local/evidence/b1c1-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
}
export async function pdaToken(page: Page) {
  const response = await page.request.post('/api/v1/auth/login', {
    data: { username: 'owner', password: 'e2e-only-password', channel: 'pda' },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data.token as string;
}
export async function catalogPost(page: Page, path: string, data: unknown, token?: string) {
  return page.request.post(`/api/v1${path}`, {
    data,
    headers: {
      Origin: 'http://127.0.0.1:5175',
      'Idempotency-Key': randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
