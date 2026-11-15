import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import request from 'supertest';
import { listFields } from '@wms/contracts';
import type { Database } from '../../apps/api/src/db/mysql.ts';
import { createApp } from '../../apps/api/src/app.ts';
import { login } from '../../apps/api/src/features/auth/service.ts';
import { webExports } from '../../apps/api/src/features/web-exports/service.ts';

export async function verifyCapacity(db: Database) {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  assert.match(name, /^maozhi_test_[a-f0-9]{24}$/);
  await db.run(`INSERT INTO master_products(code,name,source_kind,origin_kind,inventory_eligible,created_at,updated_at)
    VALUES('WL-P100000','容量边界','erp-product','legacy',1,'2026-11-01','2026-11-01')`);
  await db.run(
    "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('DEMO-WH','WL-P100000',2,'0.6000')",
  );
  await db.run(`INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,created_by,created_at)
    VALUES('WL-R100000','WL-RK-100000','DEMO-SUPPLIER','DEMO-WH','owner','2026-11-01')`);
  await db.run(`INSERT INTO outbound_orders(id,order_no,customer_name,warehouse_code,vehicle_no,created_at)
    VALUES('WL-O100000','WL-CK-100000','容量边界','DEMO-WH','合成车牌','2026-11-01')`);
  await db.run(`INSERT INTO operation_log(action,target_id,actor,trace_id,before_json,after_json,created_at)
    VALUES('list.fixture','WL-R100000','owner','capacity-100001','{}','{}','2026-11-02')`);
  const session = await login(
    db,
    { username: 'owner', password: 'perf-only-password', channel: 'web' },
    { username: 'owner', traceId: 'b6i-capacity' },
  );
  const api = request(createApp(db, ['http://localhost:5173']));
  const results = [];
  const queries = {
    stock: { product: 'WL-P', source: 'erp-product' },
    audit: { action: 'list.fixture', from: '2026-11-01T00:00:00Z' },
    inbound: { keyword: 'WL-RK-' },
    outbound: { keyword: 'WL-CK-' },
  };
  for (const kind of ['stock', 'audit', 'inbound', 'outbound'] as const) {
    const page = await api
      .get(`/api/v1/web/lists/${kind}`)
      .query(queries[kind])
      .set('Cookie', `wms_session=${session.token}`)
      .expect(200);
    assert.equal(page.body.data.total, 100001);
    const response = await api
      .post('/api/v1/web/exports')
      .set('Cookie', `wms_session=${session.token}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        kind,
        query: queries[kind],
        scope: 'all',
        selected: [],
        format: 'xlsx',
        requestId: randomUUID(),
        columns: listFields[kind].map((f) => f.key),
        viewToken: page.body.data.viewToken,
      })
      .expect(422);
    assert.equal(response.body.code, 'EXPORT_TOO_LARGE');
    assert.match(response.body.message, /100,001/);
    assert.equal(await (await webExports(db)).current(), null);
    results.push({ kind, actualRows: page.body.data.total, status: response.status, code: response.body.code });
  }
  await writeFile('.local/evidence/b6i-1/capacity.json', JSON.stringify(results, null, 2));
  console.log('CAPACITY', JSON.stringify(results));
}
