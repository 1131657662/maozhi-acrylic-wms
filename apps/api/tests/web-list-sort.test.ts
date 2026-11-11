import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberingFixture } from './numbering-fixture.ts';
import { seedListEvidence } from '../../../scripts/e2e-list-fixtures.ts';
import { confirmScannedFixture, actor } from './fixture.ts';
import { randomUUID } from 'node:crypto';
import { frozenOrder } from './inventory-fixture.ts';

test('Web 包吨排序覆盖完整结果，软删行不影响排序与分页', async () => {
  const context = await numberingFixture();
  try {
    await seedListEvidence(context.db);
    await context.db.run("UPDATE inbound_lines SET packages=30,weight_tonnes='8.0000' WHERE id='000123-R1'");
    await context.db.run(
      "UPDATE outbound_lines SET planned_packages=30,planned_weight_tonnes='8.0000' WHERE id='000123-O1'",
    );
    for (const kind of ['inbound', 'outbound']) {
      const prefix = kind === 'inbound' ? 'R' : 'O';
      const keys = kind === 'inbound' ? ['packages', 'weightGrams'] : ['plannedPackages', 'plannedWeightGrams'];
      for (const sortBy of keys) {
        const response = await context.web
          .get(`/api/v1/web/lists/${kind}`)
          .query({ keyword: `WL-${prefix === 'R' ? 'RK' : 'CK'}-`, sortBy, direction: 'desc', pageSize: 20 })
          .expect(200);
        assert.equal(response.body.data.items[0].id, `WL-${prefix}000123`);
        const ascending = await context.web
          .get(`/api/v1/web/lists/${kind}`)
          .query({ keyword: `WL-${prefix === 'R' ? 'RK' : 'CK'}-`, sortBy, direction: 'asc', pageSize: 20 })
          .expect(200);
        assert.equal(
          ascending.body.data.items[0][sortBy],
          sortBy.endsWith('Packages') || sortBy === 'packages' ? 2 : 600000,
        );
      }
    }
  } finally {
    await context.dispose();
  }
});

test('Web 人工实发包吨支持服务端排序', async () => {
  const context = await numberingFixture();
  try {
    await seedListEvidence(context.db);
    const order = await frozenOrder(context.db);
    await confirmScannedFixture(context.db, { planId: order.id, expected: order, key: randomUUID(), actor });
    for (const sortBy of ['actualPackages', 'actualWeightGrams']) {
      const response = await context.web
        .get('/api/v1/web/lists/outbound')
        .query({ sortBy, direction: 'desc', pageSize: 20 })
        .expect(200);
      assert.equal(response.body.data.items[0].id, 'DEMO-001');
      assert.equal(response.body.data.items[0][sortBy], sortBy === 'actualPackages' ? 2 : 600000);
    }
  } finally {
    await context.dispose();
  }
});
