import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  webInboundQuerySchema,
  webOutboundQuerySchema,
  webStockQuerySchema,
  webAuditQuerySchema,
} from '@wms/contracts';
import { exportFixture, exportQueries } from './export-fixture.ts';
import { exportReader } from '../src/features/web-exports/read.ts';
import type { ExportCursor } from '../src/features/web-exports/keyset.ts';
import { listWebInbound } from '../src/features/web-lists/inbound.ts';
import { listWebOutbound } from '../src/features/web-lists/outbound.ts';
import { listWebStock } from '../src/features/web-lists/stock.ts';
import { listWebAudit } from '../src/features/web-lists/audit.ts';
import { installProbe, measurement, probe } from '../../../scripts/b6b/probe.ts';

const cases = [
  {
    kind: 'stock',
    sorts: ['warehouseCode', 'productCode', 'productName', 'packages', 'weightGrams'],
    read: (db: Parameters<typeof listWebStock>[0], q: Record<string, string>) =>
      listWebStock(db, { ...webStockQuerySchema.parse(q), pageSize: Number(q.pageSize ?? 200) }),
  },
  {
    kind: 'inbound',
    sorts: [
      'receiptNo',
      'createdAt',
      'supplierName',
      'warehouseName',
      'status',
      'postingState',
      'packages',
      'weightGrams',
    ],
    read: (db: Parameters<typeof listWebInbound>[0], q: Record<string, string>) =>
      listWebInbound(db, { ...webInboundQuerySchema.parse(q), pageSize: Number(q.pageSize ?? 200) }),
  },
  {
    kind: 'outbound',
    sorts: [
      'orderNo',
      'createdAt',
      'customerName',
      'warehouseName',
      'vehicleNo',
      'status',
      'plannedPackages',
      'plannedWeightGrams',
      'actualPackages',
      'actualWeightGrams',
    ],
    read: (db: Parameters<typeof listWebOutbound>[0], q: Record<string, string>) =>
      listWebOutbound(db, { ...webOutboundQuerySchema.parse(q), pageSize: Number(q.pageSize ?? 200) }),
  },
  {
    kind: 'audit',
    sorts: ['createdAt', 'id', 'action', 'targetId', 'objectLabel', 'actor'],
    read: (db: Parameters<typeof listWebAudit>[0], q: Record<string, string>) =>
      listWebAudit(db, { ...webAuditQuerySchema.parse(q), pageSize: Number(q.pageSize ?? 200) }),
  },
] as const;

for (const item of cases)
  test(`B6i-1 ${item.kind}: keysets preserve every sort, NULLs, ties and varying batch sizes`, async () => {
    const f = await exportFixture(37);
    const restore = installProbe();
    try {
      if (item.kind === 'audit') await seedAttempts(f.db);
      if (item.kind === 'stock')
        await f.db.run(`INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes)
      SELECT 'OTHER-WH',product_code,3,'0.9000' FROM stock WHERE product_code LIKE 'WL-P%'`);
      for (const sortBy of item.sorts)
        for (const direction of ['asc', 'desc'])
          for (const pageSize of ['20', '50', '200']) {
            const query = { ...exportQueries[item.kind], sortBy, direction, pageSize, page: '2' };
            const expected = await item.read(f.db, { ...query, page: '1', pageSize: '200' });
            const read = exportReader(item.kind, query);
            const sql = measurement();
            const initial = await probe.run(sql, () => read(f.db));
            const displayed = await item.read(f.db, query);
            assert.equal(initial.viewToken, displayed.viewToken);
            const actual: Record<string, unknown>[] = [];
            let after: ExportCursor | undefined;
            await probe.run(sql, async () => {
              while (actual.length < initial.total) {
                const page = await read(f.db, { after, size: [1, 7, 13][actual.length % 3]!, snapshot: initial });
                assert.ok(page.nextCursor, `${sortBy} ${direction}: cursor must progress`);
                assert.ok(page.nextCursor.position > (after?.position ?? 0));
                after = page.nextCursor;
                actual.push(...page.items);
              }
              const empty = await read(f.db, { after, size: 7, snapshot: initial });
              assert.equal(empty.items.length, 0);
            });
            assert.deepEqual(actual, expected.items, `${sortBy} ${direction}`);
            assert.equal(
              sql.queries.some((q) => /\bOFFSET\b/i.test(q.sql)),
              false,
            );
          }
    } finally {
      restore();
      await f.dispose();
    }
  });

async function seedAttempts(db: Parameters<typeof listWebAudit>[0]) {
  await db.run(
    `UPDATE operation_log SET created_at='2026-11-14 12:00:00.000',target_no=IF(id%2=0,NULL,'同号') WHERE action='list.fixture'`,
  );
  await db.run(`INSERT INTO operation_attempts(attempt_id,occurred_at,actor,channel,action,target_kind,target_id,
    target_no,trace_id,result,effect_state,failure_reason,error_code,input_summary) VALUES
    ('00000000-0000-4000-8000-000000000001','2026-11-14 12:00:00','owner','web','list.fixture','inbound','WL-R000001','同号','fixture','failed','not_applied','合成失败','SYNTHETIC','{}'),
    ('00000000-0000-4000-8000-000000000002','2026-11-14 12:00:00','owner','web','list.fixture','inbound','WL-R000001',NULL,'fixture','failed','not_applied','合成失败','SYNTHETIC','{}')`);
}
