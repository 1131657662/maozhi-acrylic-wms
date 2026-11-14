import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, origin } from './numbering-fixture.ts';
import { publicStocktakeSchema, publicStocktakeLineSchema } from '@wms/contracts';

export const hiddenKeys = new Set([
  'snapshot',
  'snapshotHash',
  'snapshotPackages',
  'snapshotWeightGrams',
  'packagesDelta',
  'weightDeltaGrams',
  'changedCount',
  'averageWeight',
  'averageWeightGrams',
  'unitWeight',
]);
export function assertNoBook(value: unknown): void {
  if (typeof value === 'string' && /^[\[{]/.test(value)) {
    try {
      value = JSON.parse(value);
    } catch {
      return;
    }
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(hiddenKeys.has(key), false, `账面字段泄露：${key}`);
    assertNoBook(child);
  }
}
export async function blindFixture(mode: 'open' | 'blind' = 'blind') {
  const c = await numberingFixture();
  try {
    const response = await c.web
      .post('/api/v1/stocktakes')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ warehouseCode: 'DEMO-WH', mode })
      .expect(200);
    const take = publicStocktakeSchema.parse(response.body.data);
    return { ...c, take, creation: response.body, base: `/api/v1/stocktakes/${take.id}` };
  } catch (error) {
    await c.dispose();
    throw error;
  }
}
export type BlindFixture = Awaited<ReturnType<typeof blindFixture>>;
export async function saveBlind(c: BlindFixture, expectedRevision = 0) {
  return c.web
    .put(`${c.base}/lines/ACR-032`)
    .set('Origin', origin)
    .set('Idempotency-Key', randomUUID())
    .send({ expectedRevision, actual: { packages: 5, weightGrams: 1523100 } })
    .expect(200);
}
export async function revealBlind(c: BlindFixture, expectedRevision = 1, key: string = randomUUID()) {
  return c.web
    .post(`/api/v1/stocktake/${c.take.id}/reveal`)
    .set('Origin', origin)
    .set('Idempotency-Key', key)
    .send({ expectedRevision });
}
export function assertVisibleLine(value: unknown): void {
  const line = publicStocktakeLineSchema.parse(value);
  assert.equal(line.visibility, 'visible');
  if (line.visibility === 'visible') {
    assert.deepEqual(line.snapshot, { packages: 6, weightGrams: 1800000 });
    assert.equal(line.packagesDelta, -1);
    assert.equal(line.weightDeltaGrams, -276900);
  }
}
