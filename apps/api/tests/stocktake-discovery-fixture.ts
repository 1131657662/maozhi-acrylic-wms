import { randomUUID } from 'node:crypto';
import { numberingFixture, origin } from './numbering-fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { saveReading } from '../src/features/stocktake/save-reading.ts';
import { actor } from './fixture.ts';
import type { Database } from '../src/db/mysql.ts';

export const discoveryInput = {
  productCode: 'DISC-001',
  packages: 3,
  weightGrams: 812300,
  reason: '现场发现未登记货物',
};
export async function discoveryProduct(db: Database, code = discoveryInput.productCode) {
  await db.run(
    `INSERT INTO master_products(code,name,active,created_at,updated_at,origin_kind,inventory_eligible)
    VALUES(?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'local',1)`,
    [code, `发现腈纶 ${code}`],
  );
}
export async function discoveryFixture(mode: 'open' | 'blind' = 'open') {
  const c = await numberingFixture();
  try {
    await discoveryProduct(c.db);
    const take = await createStocktake(
      c.db,
      { warehouseCode: 'DEMO-WH', productCodes: ['ACR-032'], mode },
      randomUUID(),
      actor,
    );
    await saveReading(c.db, {
      id: take.id,
      productCode: 'ACR-032',
      input: {
        expectedRevision: 0,
        actual: { packages: 5, weightGrams: 1500000 },
      },
      key: randomUUID(),
      actor,
    });
    return { ...c, take, base: `/api/v1/stocktake/${take.id}/discoveries`, detail: `/api/v1/stocktakes/${take.id}` };
  } catch (error) {
    await c.dispose();
    throw error;
  }
}
export type DiscoveryFixture = Awaited<ReturnType<typeof discoveryFixture>>;
export function addDiscovery(c: DiscoveryFixture, input = discoveryInput, key = randomUUID()) {
  return c.web.post(c.base).set('Origin', origin).set('Idempotency-Key', key).send(input);
}
export function editDiscovery(c: DiscoveryFixture, lineId: string, version = 0, packages = 4) {
  return c.web
    .patch(`${c.base}/${lineId}`)
    .set('Origin', origin)
    .set('Idempotency-Key', randomUUID())
    .send({ version, packages, weightGrams: 812300, reason: '重新核对发现数量' });
}
export function removeDiscovery(c: DiscoveryFixture, lineId: string, version = 0, key = randomUUID()) {
  return c.web.delete(`${c.base}/${lineId}`).set('Origin', origin).set('Idempotency-Key', key).send({ version });
}
