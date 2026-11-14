import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { discoveryFixture, addDiscovery, editDiscovery, removeDiscovery } from './stocktake-discovery-fixture.ts';
import { assertNoBook } from './stocktake-blind-fixture.ts';
import { origin } from './numbering-fixture.ts';
import { exportStocktake } from '../src/features/stocktake/export.ts';

test('B6e-2 未揭示盲盘返回自录发现行，所有HTTP出口及审计无账面字段', async () => {
  const c = await discoveryFixture('blind');
  try {
    const added = await addDiscovery(c).expect(200);
    assertNoBook(added.body);
    const line = added.body.data;
    const edited = await editDiscovery(c, line.id).expect(200);
    assertNoBook(edited.body);
    const detail = (await c.web.get(c.detail).expect(200)).body;
    assert.equal(detail.data.discoveries.items[0].packages, 4);
    for (const path of ['/api/v1/stocktakes', c.detail, `${c.detail}/lines`])
      assertNoBook((await c.web.get(path).expect(200)).body);
    for (const kind of ['blank', 'result'] as const) {
      const result = await exportStocktake(c.db, c.take.id, kind);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(Uint8Array.from(result.buffer).buffer);
      const sheet = book.worksheets[0]!;
      assert.equal(sheet.rowCount, 3);
      assert.equal(sheet.columnCount, 5);
      assert.equal(sheet.getCell(3, 2).value, 'DISC-001');
      assert.equal(sheet.getCell(3, 4).value, kind === 'result' ? 4 : '');
    }
    const logs = await c.db.all('SELECT before_json,after_json,projection_json FROM operation_log WHERE target_id=?', [
      c.take.id,
    ]);
    for (const log of logs) assertNoBook(log);
    const removed = await removeDiscovery(c, line.id, 1).expect(200);
    assertNoBook(removed.body);
    const newLine = (await addDiscovery(c).expect(200)).body.data;
    const current = (await c.web.get(c.detail).expect(200)).body.data;
    await c.web
      .post(`/api/v1/stocktake/${c.take.id}/reveal`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ expectedRevision: current.revision })
      .expect(200);
    const revealed = (await c.web.get(`${c.detail}/lines`).expect(200)).body.data.items;
    const found = revealed.find((row: { discovery?: { id: string } }) => row.discovery?.id === newLine.id);
    assert.deepEqual(found.snapshot, { packages: 0, weightGrams: 0 });
    assert.equal(found.packagesDelta, 3);
  } finally {
    await c.dispose();
  }
});
test('B6e-2 发现行与快照明细合并分页，详情发现行独立分页', async () => {
  const c = await discoveryFixture();
  try {
    await addDiscovery(c).expect(200);
    const first = (await c.web.get(`${c.detail}/lines?pageSize=1&page=1`).expect(200)).body.data;
    const next = (await c.web.get(`${c.detail}/lines?pageSize=1&page=2`).expect(200)).body.data;
    assert.equal(first.total, 2);
    assert.equal(first.items.length, 1);
    assert.equal(next.items.length, 1);
    assert.equal(first.items[0].productCode, 'ACR-032');
    assert.equal(next.items[0].productCode, 'DISC-001');
    const detail = (await c.web.get(`${c.detail}?pageSize=1&page=2`).expect(200)).body.data;
    assert.equal(detail.discoveries.total, 1);
    assert.deepEqual(detail.discoveries.items, []);
  } finally {
    await c.dispose();
  }
});
