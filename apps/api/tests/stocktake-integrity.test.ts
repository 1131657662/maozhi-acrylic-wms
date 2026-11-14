import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { actor, fact } from './fixture.ts';
import { version } from './multi-shipment-fixture.ts';
import { partialStocktake, registerPending, rejectChecklist } from './stocktake-integrity-fixture.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { postStocktake } from '../src/features/stocktake/post.ts';
import { postCommand } from './stocktake-fixture.ts';
import { lockUnpostedOrders, unpostedDocuments } from '../src/features/stocktake/unposted.ts';

test('B6e-3 部分发货含快照前单；登记未收妥去重，补传使旧ACK失效，重新核对回写正确', async () => {
  const c = await partialStocktake();
  try {
    assert.equal(c.preview.unposted.find((r) => r.id === c.order.id)?.status, 'partially_shipped');
    assert.equal(c.preview.unposted.find((r) => r.id === c.order.id)?.unreceivedRecords, null);
    const pending = fact();
    await registerPending(c.db, c.order, [pending]);
    await registerPending(c.db, c.order, [pending]);
    await rejectChecklist(c.db, c.preview);
    const before = await stocktakePreview(c.db, c.preview.stocktake.id);
    assert.equal(before.unposted.find((r) => r.id === c.order.id)?.unreceivedRecords, 1);
    assert.equal(before.unposted.find((r) => r.id === c.order.id)?.receivedRecords, 0);
    await recordFact(c.db, {
      planId: c.order.id,
      fact: pending,
      actor,
      context: { outboundLineId: c.order.lines[0]!.id, sourceSpec: '合成规格', resolvedAt: null },
    });
    await rejectChecklist(c.db, before);
    const next = await stocktakePreview(c.db, c.preview.stocktake.id);
    const entry = next.unposted.find((r) => r.id === c.order.id)!;
    assert.equal(entry.unreceivedRecords, 0);
    assert.equal(entry.receivedRecords, 1);
    assert.ok(entry.lastReceivedAt);
    assert.equal(entry.scannedPackages, 1);
    const command = postCommand(next);
    command.input.acknowledgeSnapshotBasis = true;
    const result = await postStocktake(c.db, command);
    assert.equal(result.status, 'completed');
    const stock = await c.db.get(
      "SELECT packages,weight_tonnes FROM stock WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032'",
    );
    assert.equal(Number(stock?.packages), 179);
    assert.equal(String(stock?.weight_tonnes), '53.7000');
    const journal = await c.db.all('SELECT * FROM stock_journal WHERE operation_id=?', [result.operationId]);
    assert.equal(journal.length, 1);
    assert.equal(Number(journal[0]!.packages_delta), -1);
    assert.equal(String(journal[0]!.tonnes_delta), '-0.3000');
    assert.equal(Number(journal[0]!.packages_before), 180);
    assert.equal(Number(journal[0]!.packages_after), 179);
    assert.deepEqual(await postStocktake(c.db, command), result);
    assert.equal((await c.current()).status, 'partially_shipped');
  } finally {
    await c.dispose();
  }
});

for (const field of ['quantity', 'vehicle', 'memo'] as const)
  test(`B6e-3 预览后修改计划 ${field} 使旧令牌409且全部业务表不变`, async () => {
    const c = await partialStocktake();
    try {
      const order = await c.current();
      const plan =
        field === 'quantity'
          ? { lines: [{ id: order.lines[0]!.id, plannedPackages: 101, plannedWeightGrams: 30300000 }] }
          : field === 'vehicle'
            ? { vehicleNo: '重新核对车号' }
            : { memo: '重新核对备注' };
      await c.send(`${c.path}/plan`, { ...version(order), plan }, randomUUID(), 'patch').expect(200);
      await rejectChecklist(c.db, c.preview);
    } finally {
      await c.dispose();
    }
  });

test('B6e-3 预览后短关清单移除使旧令牌409；窗口内仍不能完成发货', async () => {
  const c = await partialStocktake();
  try {
    const order = await c.current();
    const blocked = await c
      .send(`${c.path}/shipments`, {
        ...version(order),
        lines: [{ lineId: order.lines[0]!.id, actualPackages: 80, actualWeightGrams: 24000000 }],
      })
      .expect(409);
    assert.equal(blocked.body.code, 'WAREHOUSE_STOCKTAKE_PAUSED');
    await c.send(`${c.path}/short-close`, { ...version(order), reason: '剩余不发' }).expect(200);
    await rejectChecklist(c.db, c.preview);
    assert.ok(!(await stocktakePreview(c.db, c.preview.stocktake.id)).unposted.some((r) => r.id === order.id));
  } finally {
    await c.dispose();
  }
});

test('B6e-3 部分发货单头与行均持锁；清单与行锁查询固定批量', async () => {
  const c = await partialStocktake();
  try {
    const queries: string[] = [];
    const all = c.db.all.bind(c.db);
    c.db.all = async (sql, values) => {
      queries.push(sql);
      return all(sql, values);
    };
    await unpostedDocuments(c.db, c.preview.stocktake);
    assert.equal(queries.length, 2);
    c.db.all = all;
    await c.db.transaction(async (tx) => {
      const locks: string[] = [],
        read = tx.all.bind(tx);
      tx.all = async (sql, values) => {
        locks.push(sql);
        return read(sql, values);
      };
      await lockUnpostedOrders(tx, c.preview.stocktake.warehouseCode);
      assert.equal(locks.length, 2);
      for (const [table, id] of [
        ['outbound_orders', c.order.id],
        ['outbound_lines', c.order.lines[0]!.id],
      ])
        await assert.rejects(
          c.db.withConnection((other) => other.get(`SELECT id FROM ${table} WHERE id=? FOR UPDATE NOWAIT`, [id!])),
          (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ER_LOCK_NOWAIT',
        );
    });
  } finally {
    await c.dispose();
  }
});

test('B6e-3 预览后完成发货仅改变状态也使旧令牌409', async () => {
  const c = await partialStocktake();
  try {
    const order = await c.current();
    await c
      .send(
        `${c.path}/plan`,
        {
          ...version(order),
          plan: {
            lines: [{ id: order.lines[0]!.id, plannedPackages: 20, plannedWeightGrams: 6000000 }],
          },
        },
        randomUUID(),
        'patch',
      )
      .expect(200);
    const before = await stocktakePreview(c.db, c.preview.stocktake.id);
    assert.equal(before.unposted.find((r) => r.id === c.order.id)?.status, 'partially_shipped');
    await c.send(`${c.path}/complete`, version(await c.current())).expect(200);
    await rejectChecklist(c.db, before);
  } finally {
    await c.dispose();
  }
});
