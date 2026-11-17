import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { z } from 'zod';
import { openDatabase, type Database } from '../../apps/api/src/db/mysql';
import { adminConfig } from '../../scripts/mysql/local-config';
import { login } from '../../apps/api/src/features/auth/service';

export function e2eDatabase() {
  const { name } = z
    .object({ name: z.string().regex(/^maozhi_test_[a-f0-9]{24}$/) })
    .parse(JSON.parse(readFileSync('.local/e2e-database.json', 'utf8')));
  return openDatabase({ ...adminConfig(), database: name });
}
export async function loginInventory(page: Page) {
  // Inventory scenarios need an authenticated session; login UI/rate limits have separate coverage.
  const db = e2eDatabase();
  try {
    const session = await login(
      db,
      { username: 'owner', password: 'e2e-only-password', channel: 'web' },
      { username: 'owner', traceId: 'inventory-e2e-session' },
    );
    await page.context().addCookies([
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
    ]);
  } finally {
    await db.close();
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible();
}
export async function inventoryCell(db: Database) {
  const code = `TX-${randomUUID().slice(0, 8)}`;
  await db.run(
    `INSERT INTO master_products(code,name,active,source_kind,created_at,updated_at,origin_kind,inventory_eligible)
    VALUES(?, '入账验收商品',1,'erp-product',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'legacy',1)`,
    [code],
  );
  await db.run(`INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('DEMO-WH',?,6,'1.8000')`, [
    code,
  ]);
  return { productCode: code, warehouseCode: 'DEMO-WH' };
}
export async function post(page: Page, path: string, data: unknown, key = randomUUID()) {
  return page.request.post(`/api/v1${path}`, {
    data,
    headers: { Origin: 'http://127.0.0.1:5174', 'Idempotency-Key': key },
  });
}
export async function receipt(page: Page, cell: { productCode: string; warehouseCode: string }) {
  const response = await post(page, '/inbound', {
    warehouseCode: cell.warehouseCode,
    supplierCode: 'DEMO-SUPPLIER',
    lines: [{ productCode: cell.productCode, packages: 1, weightGrams: 302500 }],
  });
  expect(response.status()).toBe(200);
  return z.object({ id: z.string(), status: z.literal('pending') }).parse((await response.json()).data);
}
export async function confirmReceipt(page: Page, id: string) {
  await page.goto(`/inbound/${id}`);
  await page.getByRole('button', { name: '核对并确认入库' }).click();
  await page.getByRole('button', { name: '确认入账', exact: true }).click();
}
export async function screenshotWidths(page: Page, name: string) {
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `.local/evidence/${name}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
}
