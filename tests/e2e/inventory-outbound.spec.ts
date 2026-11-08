import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { inventorySnapshot } from '../../apps/api/tests/inventory-fixture';
import { e2eDatabase, loginInventory, inventoryCell, post } from './inventory-helpers';
import { addV1Fixture } from '../../apps/api/tests/catalog-fixture';

test('B1a3 出库不足 409 全回滚；PDA/小程序确认和调整全部 403', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await loginInventory(page);
    const cell = await inventoryCell(db);
    await db.run('UPDATE stock SET packages=0,weight_tonnes=0 WHERE product_code=?', [cell.productCode]);
    const barcode = `TEST-${randomUUID()}`;
    await addV1Fixture(db,{barcode,product:cell.productCode,tonnes:'0.3025'});
    const planResponse = await post(page, '/outbound', {
      orderNo: `TX-OUT-${randomUUID()}`,
      warehouseCode: cell.warehouseCode,
      customerCode: 'DEMO-CUST-1',
      vehicleNo: '事务验证车辆',
      lines: [{ productCode: cell.productCode, plannedPackages: 1, plannedWeightGrams: 302500 }],
    });
    expect(planResponse.status()).toBe(200);
    const id = (await planResponse.json()).data.id;
    const login = await page.request.post('/api/v1/auth/login', {
      data: { username: 'owner', password: 'e2e-only-password', channel: 'pda' },
    });
    const headers = { Authorization: `Bearer ${(await login.json()).data.token}` };
    const scanned = await page.request.post(`/api/v1/scan/plans/${id}/facts`, {
      headers,
      data: {
        id: randomUUID(),
        barcode,
        weightGrams: 302500,
        catalogVersion: 1,
        weightSource: 'catalog',
        deviceId: 'e2e-isolated',
        scannedAt: new Date().toISOString(),
        planVersion: 1,
      },
    });
    expect(scanned.status()).toBe(200);
    const scan = (await scanned.json()).data;
    const frozen = await page.request.post(`/api/v1/scan/plans/${id}/submit`, {
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      data: { revision: scan.revision, digest: scan.digest },
    });
    expect(frozen.status()).toBe(200);
    const frozenData = (await frozen.json()).data;
    const before = await inventorySnapshot(db);
    const rejected = await post(page, `/outbound/${id}/confirm`, {
      revision: frozenData.revision,
      digest: frozenData.digest,
    });
    expect(rejected.status()).toBe(409);
    expect((await rejected.json()).code).toBe('INSUFFICIENT_STOCK');
    expect(await inventorySnapshot(db)).toEqual(before);
    for (const channel of ['pda', 'miniapp']) {
      const auth = await page.request.post('/api/v1/auth/login', {
        data: { username: 'owner', password: 'e2e-only-password', channel },
      });
      const authorization = `Bearer ${(await auth.json()).data.token}`;
      const beforeDenials = await inventorySnapshot(db);
      for (const path of [`/inbound/anything/confirm`, `/outbound/${id}/confirm`, '/stock/adjustments']) {
        const denied = await page.request.post(`/api/v1${path}`, {
          headers: { Authorization: authorization },
          data: {},
        });
        expect(denied.status()).toBe(403);
      }
      expect(await inventorySnapshot(db)).toEqual(beforeDenials);
    }
    console.log('B1A3_E2E outbound_insufficient=409 database_unchanged=true pda_denials=3 miniapp_denials=3');
  } finally {
    await db.close();
  }
});
