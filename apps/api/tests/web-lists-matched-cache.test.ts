import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webInboundListSchema } from '@wms/contracts';
import { Database } from '../src/db/mysql.ts';
import { numberingFixture } from './numbering-fixture.ts';
import { seedListEvidence } from '../../../scripts/e2e-list-fixtures.ts';

const countStatements = (sqls: string[]) =>
  sqls.filter((sql) => /^\s*SELECT\s+(?:\/\*.*?\*\/\s*)?COUNT\s*\(/i.test(sql)).length;

test('商品反查第5页复用首查汇总，明细更新后重新计算', async (t) => {
  const context = await numberingFixture();
  try {
    await seedListEvidence(context.db);
    const original = Database.prototype.all,
      sqls: string[] = [];
    let capture = false;
    t.mock.method(Database.prototype, 'all', async function (this: Database, ...args: Parameters<Database['all']>) {
      if (capture) sqls.push(args[0]);
      return original.apply(this, args);
    });
    const read = async (page: number) =>
      webInboundListSchema.parse(
        (
          await context.web
            .get('/api/v1/web/lists/inbound')
            .query({ productCodes: 'WL-P000001', page, pageSize: 20 })
            .expect(200)
        ).body.data,
      );
    capture = true;
    const first = await read(1);
    assert.equal(countStatements(sqls), 1);
    sqls.length = 0;
    const fifth = await read(5);
    assert.equal(fifth.total, first.total);
    assert.deepEqual(fifth.matchedTotals, first.matchedTotals);
    assert.equal(countStatements(sqls), 0);
    const line = await context.db.get("SELECT id FROM inbound_lines WHERE product_code='WL-P000001' LIMIT 1");
    assert.ok(line);
    await context.db.run('UPDATE inbound_lines SET packages=packages+1 WHERE id=?', [String(line.id)]);
    sqls.length = 0;
    const updated = await read(1);
    assert.equal(countStatements(sqls), 1);
    assert.equal(updated.matchedTotals!.packages, first.matchedTotals!.packages + 1);
  } finally {
    t.mock.restoreAll();
    await context.dispose();
  }
});
