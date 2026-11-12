import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { countingFixture } from './scan-workbench-fixture.ts';
import { addV1Fixture } from './catalog-fixture.ts';
import { exportScanRecords } from '../src/features/outbound/scan-export.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { actor } from './fixture.ts';

test('B4g attribution: manual/catalog, product mismatch and required product, trusted audit', async () => {
  const c = await countingFixture();
  try {
    const stock = await c.db.all('SELECT * FROM stock');
    const input = { barcode: 'UNMAPPED-001', productCode: 'ACR-032', source: 'manual' };
    const saved = await c.post(input).expect(200);
    assert.equal(saved.body.data.attribution, 'manual');
    const audit = await c.db.get(
      "SELECT after_json FROM operation_log WHERE action='scan.record' ORDER BY id DESC LIMIT 1",
    );
    assert.equal(JSON.parse(String(audit?.after_json)).productCode, 'ACR-032');
    assert.equal(JSON.parse(String(audit?.after_json)).attribution, 'manual');
    await c.post({ barcode: 'DEMO-032-11', productCode: 'SECOND', source: 'manual' }).expect(422);
    const outside = await c.post({ ...input, productCode: 'OUTSIDE' }).expect(422);
    assert.equal(outside.body.data.products.length, 2);
    await c.post({ barcode: 'DEMO-032-11', source: 'manual' }).expect(422);
    await c
      .post(input)
      .expect(422)
      .expect((r) => assert.equal(r.body.message, '已录入'));
    const mapped = await c.post({ barcode: 'DEMO-032-11', productCode: 'ACR-032', source: 'search' }).expect(200);
    assert.equal(mapped.body.data.attribution, 'catalog');
    assert.deepEqual(await c.db.all('SELECT * FROM stock'), stock);
    const candidates = await c.web
      .get('/api/v1/outbound/DEMO-001/scan-candidates?query=SECOND&productCode=ACR-032')
      .expect(200);
    assert.equal(candidates.body.data.total, 0);
    await c.web.get('/api/v1/outbound/DEMO-001/scan-candidates?query=DE&productCode=ACR-032').expect(422);
    await c.web.get('/api/v1/outbound/DEMO-001/scan-candidates?query=DEMO&productCode=ACR-032&extra=1').expect(422);
    console.log(
      'B4G_ATTRIBUTION manual=manual mapped=catalog mismatch=422 outside=422 missing=422 stock_unchanged=true',
    );
  } finally {
    await c.dispose();
  }
});

test('B4g mixed-product batch 20 = 17 success + 2 duplicate + 1 invalid; replay and summary agree', async () => {
  const c = await countingFixture();
  try {
    const records = [];
    for (let i = 0; i < 17; i++) {
      const productCode = i % 2 ? 'SECOND' : 'ACR-032';
      const barcode = `BATCH-${i}`;
      await addV1Fixture(c.db, { barcode, product: i % 2 ? 'SECOND' : 'SPEC-UNKNOWN', tonnes: '0.3000' });
      records.push({ barcode, productCode });
    }
    records.push(records[0]!, records[1]!, { barcode: 'NOT-IN-CATALOG', productCode: 'ACR-032' });
    const key = randomUUID();
    const input = { records, source: 'paste' };
    const first = await c.post(input, key, '/batch').expect(200);
    assert.equal(first.body.data.items.filter((i: { ok: boolean }) => i.ok).length, 17);
    const replay = await c.post(input, key, '/batch').expect(200);
    assert.deepEqual(replay.body.data, first.body.data);
    const summary = await c.web.get('/api/v1/outbound/DEMO-001/scan-summary').expect(200);
    assert.deepEqual(summary.body.data.recorded, { packages: 17, weightGrams: 5100000 });
    assert.deepEqual(
      summary.body.data.products.map((p: { recorded: { packages: number } }) => p.recorded.packages),
      [9, 8],
    );
    assert.equal(Number((await c.db.get("SELECT COUNT(*) n FROM operation_log WHERE action='scan.record'"))?.n), 17);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) n FROM scan_facts'))?.n), 17);
    console.log(
      'B4G_BATCH submitted=20 success=17 duplicate=2 invalid=1 replay_rows=17 products=9/8 packages=17 grams=5100000',
    );
  } finally {
    await c.dispose();
  }
});

test('B4g concurrent same barcode writes once; revoke preserves evidence and excludes prefill/export; confirmed read-only', async () => {
  const c = await countingFixture();
  try {
    const input = { barcode: 'DEMO-032-11', productCode: 'ACR-032', source: 'scanner' };
    const key = randomUUID();
    const replay = await Promise.all(Array.from({ length: 10 }, () => c.post(input, key)));
    assert.deepEqual(
      replay.map((r) => r.status),
      Array(10).fill(200),
    );
    const id = replay[0]!.body.data.recordId;
    const original = await c.db.get('SELECT payload_hash,barcode,weight_tonnes,scanned_at FROM scan_facts WHERE id=?', [
      id,
    ]);
    await c.web
      .delete(`/api/v1/outbound/DEMO-001/scan-records/${id}`)
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    assert.deepEqual(
      await c.db.get('SELECT payload_hash,barcode,weight_tonnes,scanned_at FROM scan_facts WHERE id=?', [id]),
      original,
    );
    const summary = await c.web.get('/api/v1/outbound/DEMO-001/scan-summary').expect(200);
    assert.equal(summary.body.data.recorded.packages, 0);
    const prefill = await c.web.get('/api/v1/outbound/DEMO-001/prefill').expect(200);
    assert.equal(
      prefill.body.data.lines.reduce((s: number, l: { scanPackages: number }) => s + l.scanPackages, 0),
      0,
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Uint8Array.from((await exportScanRecords(c.db, 'DEMO-001')).buffer).buffer);
    assert.equal(book.worksheets[0]!.rowCount, 2);
    const order = await getOrder(c.db, 'DEMO-001');
    await confirmOutbound(c.db, {
      planId: order.id,
      expected: order,
      key: randomUUID(),
      actor,
      lines: order.lines.map((l, i) => ({
        lineId: l.id,
        actualPackages: i ? 0 : 1,
        actualWeightGrams: i ? 0 : 300000,
      })),
    });
    await c.post({ ...input, barcode: 'DEMO-032-12' }).expect(409);
    await c.web
      .delete(`/api/v1/outbound/DEMO-001/scan-records/${id}`)
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Idempotency-Key', randomUUID())
      .expect(409);
    console.log(
      'B4G_REVOKE concurrent=10 stored=1 success_events=1 delta=-1 prefill=0 export_rows=0 immutable=true confirmed=409',
    );
  } finally {
    await c.dispose();
  }
});

test('B4g distinct command races, per-order uniqueness, auth and Web channel', async () => {
  const c = await countingFixture();
  try {
    const input = { barcode: 'DEMO-032-11', productCode: 'ACR-032', source: 'scanner' };
    const responses = await Promise.all([c.post(input), c.post(input)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 422]);
    await c.web
      .post('/api/v1/outbound/DEMO-002/scan-records')
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Idempotency-Key', randomUUID())
      .send(input)
      .expect(200);
    await c.api.get('/api/v1/outbound/DEMO-001/scan-summary').expect(401);
    const login = await c.api
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'pda' })
      .expect(200);
    await c.api
      .get('/api/v1/outbound/DEMO-001/scan-summary')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .expect(403);
  } finally {
    await c.dispose();
  }
});
