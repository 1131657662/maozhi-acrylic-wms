import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { stocktakeSchema, stocktakePreviewSchema } from '@wms/contracts';
import type { Database } from '../../apps/api/src/db/mysql';
import { post } from './inventory-helpers';

export async function countCell(db: Database) {
  const code = `COUNT-${randomUUID().slice(0, 8)}`,
    name = `现场盘点 ${code}`;
  await db.run(
    'INSERT INTO master_warehouses(code,name,created_at,updated_at) VALUES(?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))',
    [code, name],
  );
  await db.run(
    "INSERT INTO master_products(code,name,source_kind,created_at,updated_at,origin_kind,inventory_eligible) VALUES(?,?,'erp-product',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'legacy',1)",
    [code, '盘点验收商品'],
  );
  await db.run('INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES(?,?,6,1.8000)', [
    code,
    code,
  ]);
  return { warehouseCode: code, productCode: code, name };
}
export async function takeFor(page: Page, warehouseCode: string) {
  const response = await post(page, '/stocktakes', { warehouseCode });
  expect(response.status()).toBe(200);
  return stocktakeSchema.parse((await response.json()).data);
}
export async function readCount(page: Page, id: string, productCode: string) {
  const response = await page.request.put(`/api/v1/stocktakes/${id}/lines/${productCode}`, {
    headers: { Origin: 'http://127.0.0.1:5174', 'Idempotency-Key': randomUUID() },
    data: { expectedRevision: 0, actual: { packages: 5, weightGrams: 1523100 } },
  });
  expect(response.status()).toBe(200);
}
export async function countPreview(page: Page, id: string) {
  const response = await page.request.get(`/api/v1/stocktakes/${id}/preview`);
  expect(response.status()).toBe(200);
  return stocktakePreviewSchema.parse((await response.json()).data);
}
