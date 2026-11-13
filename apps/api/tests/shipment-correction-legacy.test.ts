import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { correctionFixture } from './correction-fixture.ts';
import { origin } from './numbering-fixture.ts';
import { migrateDown, migrateUp } from '../src/db/migrate.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

test('B5c-2 missing modern shipment evidence cannot use the pre-016 compatibility path', async () => {
  const c = await correctionFixture('outbound');
  try {
    await c.db.run('DELETE FROM outbound_shipment_lines');
    await c.db.run('DELETE FROM outbound_shipments');
    const input = await c.input(),
      before = await businessFingerprint(c.db);
    await c.post(input).expect(409);
    assert.deepEqual(await businessFingerprint(c.db), before);
    const preview = (await c.web.get(`${c.path}/lifecycle`).expect(200)).body.data;
    assert.equal(preview.allowed, false);
  } finally {
    await c.dispose();
  }
});

for (const replenish of [false, true])
  test(`B5c-2 pre-016 NULL correction remains readable and reversible; replenish=${replenish}`, async () => {
    const c = await correctionFixture('outbound');
    try {
      // Disposable DB only: reproduce a genuine pre-016 confirmation, including its audit shape.
      await c.db.run('DELETE FROM outbound_shipment_lines');
      await c.db.run('DELETE FROM outbound_shipments');
      await c.db.run(
        "UPDATE operation_log SET after_json=JSON_REMOVE(after_json,'$.shipmentId') WHERE action='outbound.confirm'",
      );
      const original = (await c.detail()).body.data;
      const stock = Number((await c.db.get("SELECT packages FROM stock WHERE product_code='ACR-032'"))!.packages);
      const response = await c.post(await c.input({ packages: -1, weightGrams: -300000 })).expect(200);
      assert.equal(response.body.data.lines[0].shipmentLineId, null);
      let current = (await c.detail()).body.data;
      assert.equal(current.status, 'partially_shipped');
      assert.equal(current.corrections.effective.packages, original.actualPackages - 1);
      const list = await c.web.get('/api/v1/web/lists/outbound').query({ keyword: original.orderNo }).expect(200);
      assert.equal(list.body.data.items[0].actualPackages, original.actualPackages - 1);
      const send = (action: string, body: object) =>
        c.web.post(`${c.path}/${action}`).set('origin', origin).set('idempotency-key', randomUUID()).send(body);
      if (replenish) {
        await send('shipments', {
          revision: current.revision,
          digest: current.digest,
          lines: [{ lineId: current.lines[0].id, actualPackages: 1, actualWeightGrams: 300000 }],
        }).expect(200);
        current = (await c.detail()).body.data;
        assert.equal(current.status, 'confirmed');
        assert.equal(current.corrections.effective.packages, original.actualPackages);
        for (const table of ['master_products', 'master_customers', 'master_suppliers', 'master_vehicles'])
          await c.db.run(`UPDATE ${table} SET search_text=NULL`);
        await migrateDown(c.db); // Remove empty 023 before exercising the 020 migration roundtrip.
        await migrateDown(c.db); // 022: restore the pre-search-text migration state.
        await migrateDown(c.db); // Empty 021 before the intended 020 migration.
        await migrateDown(c.db);
        await migrateUp(c.db);
        assert.equal(
          (await c.db.get('SELECT shipment_line_id FROM document_correction_lines'))!.shipment_line_id,
          null,
        );
        assert.equal((await c.detail()).body.data.corrections.effective.packages, original.actualPackages);
      }
      const preview = (await c.web.get(`${c.path}/lifecycle`).expect(200)).body.data;
      assert.equal(preview.allowed, true, JSON.stringify(preview.blockers));
      await send('reverse', { reason: '旧更正兼容验收', expectedToken: preview.token }).expect(200);
      assert.equal(
        (await c.db.get("SELECT packages FROM stock WHERE product_code='ACR-032'"))!.packages,
        stock + original.actualPackages,
      );
      console.log(
        `B5C2_PRE016 shipment_reference=NULL pending_after_correction=1 replenished=${replenish} readable=true reverse_restored=true`,
      );
    } finally {
      await c.dispose();
    }
  });
