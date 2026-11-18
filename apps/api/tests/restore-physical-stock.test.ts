import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backupBaselineSchema } from '@wms/contracts';
import { fixture } from './fixture.ts';
import { captureBaseline } from '../src/features/maintenance/baseline.ts';
import { buildRestoreReport } from '../src/features/maintenance/restore-report.ts';

test('F03 同仓同品两条物理行换序无差异，改动只定位到对应行；旧基线不猜归属', async () => {
  const { db, dispose } = await fixture();
  try {
    await db.run("UPDATE stock SET packages=1 WHERE product_code='ACR-032'");
    await db.run(
      "INSERT INTO stock(warehouse_code,product_code,source_del_flag,packages,weight_tonnes) VALUES('DEMO-WH','ACR-032',1,2,0.4)",
    );
    const baseline = await captureBaseline(db);
    assert.deepEqual(
      baseline.inventory.cells.map((row) => [row.sourceDelFlag, row.packages]),
      [
        [0, '1'],
        [1, '2'],
      ],
    );
    const reordered = structuredClone(baseline);
    reordered.inventory.cells.reverse();
    const same = buildRestoreReport(baseline, reordered);
    assert.equal(same.outcome, 'passed');
    assert.deepEqual(
      same.items
        .filter((item) => item.label.startsWith('仓库') && item.label.endsWith('包数'))
        .map((item) => item.actual),
      ['1', '2'],
    );
    const legacy = backupBaselineSchema.parse({ ...baseline, version: 1 });
    const limited = buildRestoreReport(legacy, reordered);
    assert.equal(limited.outcome, 'limited');
    assert.equal(limited.items.filter((item) => item.conclusion === 'unverified').length, 1);
    reordered.inventory.cells[0]!.packages = '3';
    const different = buildRestoreReport(baseline, reordered);
    assert.deepEqual(
      different.items.filter((item) => item.conclusion === 'mismatch').map((item) => [item.label, item.difference]),
      [['仓库 DEMO-WH / 商品 ACR-032 / 已删除记录包数', '差额 +1']],
    );
    assert.equal(buildRestoreReport(legacy, reordered).outcome, 'mismatch');
  } finally {
    await dispose();
  }
});
