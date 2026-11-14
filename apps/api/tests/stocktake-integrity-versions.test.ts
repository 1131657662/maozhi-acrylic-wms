import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor, fact } from './fixture.ts';
import { counted } from './stocktake-fixture.ts';
import { rejectChecklist } from './stocktake-integrity-fixture.ts';
import { discoveryFixture, addDiscovery } from './stocktake-discovery-fixture.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';
import { saveReading } from '../src/features/stocktake/save-reading.ts';
import { recordFact } from '../src/features/scan/service.ts';

test('B6e-3 预览后新增发现行使旧令牌409', async () => {
  const c = await discoveryFixture();
  try {
    const before = await stocktakePreview(c.db, c.take.id);
    await addDiscovery(c).expect(200);
    await rejectChecklist(c.db, before);
  } finally {
    await c.dispose();
  }
});

test('B6e-3 同值重存读数后头版本不变也能检测行版本集合变化', async () => {
  const c = await fixture();
  try {
    const actual = { packages: 5, weightGrams: 1523100 };
    const before = await counted(c.db, actual);
    await saveReading(c.db, {
      id: before.stocktake.id,
      productCode: 'ACR-032',
      input: { expectedRevision: 1, actual },
      key: randomUUID(),
      actor,
    });
    // Disposable DB fault injection isolates the explicit row-version signature from the header revision.
    await c.db.run('UPDATE stocktakes SET revision=? WHERE id=?', [before.stocktake.revision, before.stocktake.id]);
    await rejectChecklist(c.db, before);
  } finally {
    await c.dispose();
  }
});

test('B6e-3 最新接收时间独立绑定，即使记录数与单头版本均未变化', async () => {
  const c = await fixture();
  try {
    const received = fact();
    const take = await counted(c.db);
    await recordFact(c.db, { planId: 'DEMO-001', fact: received, actor });
    const before = await stocktakePreview(c.db, take.stocktake.id);
    // Timestamp-only external change in disposable DB proves count/revision are not the only guards.
    await c.db.run('UPDATE scan_facts SET received_at=DATE_ADD(received_at,INTERVAL 1 SECOND) WHERE id=?', [
      received.id,
    ]);
    const after = await stocktakePreview(c.db, before.stocktake.id);
    assert.equal(after.unposted[0]!.receivedRecords, before.unposted[0]!.receivedRecords);
    assert.equal(after.unposted[0]!.revision, before.unposted[0]!.revision);
    await rejectChecklist(c.db, before);
  } finally {
    await c.dispose();
  }
});
