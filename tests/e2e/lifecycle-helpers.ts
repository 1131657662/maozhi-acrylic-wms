import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { lifecyclePreviewSchema, detailSchema, type LifecycleKind } from '@wms/contracts';
import type { Database } from '../../apps/api/src/db/mysql';
import { addV1Fixture } from '../../apps/api/tests/catalog-fixture';
import { login } from '../../apps/api/src/features/auth/service';
import { inventoryCell, post, receipt } from './inventory-helpers';

export async function previewFor(page: Page, kind: LifecycleKind, id: string) {
  const response = await page.request.get(`/api/v1/${kind}/${id}/lifecycle`);
  expect(response.status()).toBe(200);
  return lifecyclePreviewSchema.parse((await response.json()).data);
}
export async function confirmedDocument(page: Page, db: Database, kind: LifecycleKind) {
  const cell = await inventoryCell(db);
  if (kind === 'inbound') {
    const created = await receipt(page, cell);
    expect((await post(page, `/inbound/${created.id}/confirm`, {})).status()).toBe(200);
    return { ...cell, id: created.id };
  }
  const barcode = `REV-${randomUUID()}`;
  await addV1Fixture(db, { barcode, product: cell.productCode, tonnes: '0.3025' });
  const created = await post(page, '/outbound', {
    warehouseCode: cell.warehouseCode,
    customerCode: 'DEMO-CUST-1',
    vehicleNo: '误确认验收车辆',
    lines: [{ productCode: cell.productCode, plannedPackages: 1, plannedWeightGrams: 302500 }],
  });
  expect(created.status()).toBe(200);
  const plan = detailSchema.parse((await created.json()).data);
  // This helper receives only the disposable E2E database; login UI/rate limits have separate coverage.
  const session = await login(
    db,
    { username: 'owner', password: 'e2e-only-password', channel: 'pda' },
    { username: 'owner', traceId: 'b2a-e2e-pda-session' },
  );
  const headers = { Authorization: `Bearer ${session.token}` };
  const scanResponse = await page.request.post(`/api/v1/scan/plans/${plan.id}/facts`, {
    headers,
    data: {
      id: randomUUID(),
      barcode,
      weightGrams: 302500,
      catalogVersion: 1,
      weightSource: 'catalog',
      deviceId: 'b2a-e2e',
      scannedAt: new Date().toISOString(),
      planVersion: 1,
    },
  });
  expect(scanResponse.status()).toBe(200);
  const scanned = detailSchema.parse((await scanResponse.json()).data);
  const freeze = await page.request.post(`/api/v1/scan/plans/${plan.id}/submit`, {
    headers: { ...headers, 'Idempotency-Key': randomUUID() },
    data: { revision: scanned.revision, digest: scanned.digest },
  });
  expect(freeze.status()).toBe(200);
  const frozen = detailSchema.parse((await freeze.json()).data);
  expect(
    (await post(page, `/outbound/${plan.id}/confirm`, { revision: frozen.revision, digest: frozen.digest })).status(),
  ).toBe(200);
  return { ...cell, id: plan.id };
}
