import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { batchReverseResponseSchema } from '@wms/contracts';
import { numberingFixture, newReceipt, origin } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { commandFor } from './lifecycle-fixture.ts';
import { executeLifecycle } from '../src/features/document-lifecycle/execute.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmInbound } from '../src/features/inbound/confirm.ts';

test('B6b Step 3 批量撤销逐单部分成功且重放不重复补偿', async () => {
  const { db, web, dispose } = await numberingFixture();
  try {
    const targets = [];
    for (const productCode of ['ACR-032', 'B6B-STEP3-1', 'B6B-STEP3-2']) {
      if (productCode !== 'ACR-032') {
        await db.run(
          `INSERT INTO master_products(code,name,active,created_at,updated_at,source_kind,source_del_flag,origin_kind,inventory_eligible)
           VALUES(?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'erp-product',0,'local',1)`,
          [productCode, `批量验收商品 ${productCode}`],
        );
        await db.run(
          'INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_del_flag) VALUES(?,?,10,?,0)',
          ['DEMO-WH', productCode, '3.0000'],
        );
      }
      const receipt = await createInbound(
        db,
        { ...newReceipt(), lines: [{ productCode, packages: 1, weightGrams: 302500 }] },
        randomUUID(),
        actor,
      );
      await confirmInbound(db, receipt.id, randomUUID(), actor);
      targets.push({ kind: 'inbound' as const, id: receipt.id });
    }
    const commands = await Promise.all(targets.map((target) => commandFor(db, target)));
    await executeLifecycle(db, { ...commands[2]!, key: randomUUID(), actor });
    const body = {
      kind: 'inbound' as const,
      reason: '批量撤销误确认验收',
      items: commands.map((command) => ({
        id: command.id,
        expectedToken: (command.input as { expectedToken: string }).expectedToken,
        key: command.key,
      })),
    };
    const firstResponse = await web.post('/api/v1/web/lifecycle/batch-reverse').set('Origin', origin).send(body).expect(200);
    const first = batchReverseResponseSchema.parse(firstResponse.body.data);
    const traceId = String(firstResponse.body.traceId);
    const evidence = [
      ...await db.all('SELECT attempt_id,trace_id,result FROM operation_log WHERE trace_id=?', [traceId]),
      ...await db.all('SELECT attempt_id,trace_id,result FROM operation_attempts WHERE trace_id=?', [traceId]),
    ];
    assert.equal(evidence.length, 3);
    assert.equal(new Set(evidence.map((row) => row.attempt_id)).size, 3);
    assert.equal(new Set(evidence.map((row) => row.trace_id)).size, 1);
    assert.deepEqual(evidence.map((row) => row.result).sort(), ['failed', 'success', 'success']);
    console.log('B6C1_BATCH', JSON.stringify({ evidence }));
    assert.deepEqual([first.succeeded, first.failed], [2, 1]);
    assert.deepEqual(
      first.results.map((item) => item.success),
      [true, true, false],
    );
    assert.equal(first.results[2]!.code, 'INVALID_TRANSITION');
    assert.match(first.results[2]!.message ?? '', /只能撤销/);
    const operationsAfterFirst = Number(
      (await db.get("SELECT COUNT(*) AS n FROM inventory_operations WHERE operation_type='inbound.reverse'"))?.n,
    );
    assert.equal(operationsAfterFirst, 3);
    const second = batchReverseResponseSchema.parse(
      (await web.post('/api/v1/web/lifecycle/batch-reverse').set('Origin', origin).send(body).expect(200)).body.data,
    );
    assert.deepEqual([second.succeeded, second.failed], [2, 1]);
    assert.equal(
      Number(
        (await db.get("SELECT COUNT(*) AS n FROM inventory_operations WHERE operation_type='inbound.reverse'"))?.n,
      ),
      operationsAfterFirst,
    );
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM document_closures'))?.n), 3);
    console.log(
      `B6B_STEP3_API total=${first.total} succeeded=${first.succeeded} failed=${first.failed} conflict=${first.results[2]!.code} replay_duplicate_compensation=false`,
    );
  } finally {
    await dispose();
  }
});
