import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeColumns, mergeColumns } from '../../web/src/components/BusinessList/column-config.ts';
import { clampWidth } from '../../web/src/components/BusinessList/column-settings.ts';

test('列设置按 key 合并：隐藏列缺省120，新列补默认，未知列丢弃', () => {
  const columns = completeColumns('inbound', [
    { dataIndex: 'receiptNo', width: 220, hideInSetting: true },
    { dataIndex: 'supplierName', hideInTable: true },
  ]);
  assert.ok(columns.every((column) => typeof column.width === 'number'));
  const value = mergeColumns('inbound', columns, {
    receiptNo: { width: 320 },
    supplierName: { width: 280, order: 0, show: true },
    removed: { width: 550 },
  });
  assert.equal(value.receiptNo?.width, 320);
  assert.deepEqual(value.supplierName, { width: 280, order: 0, show: true, fixed: undefined });
  assert.equal(value.productModels?.width, 120);
  assert.equal(value.productModels?.show, false);
  assert.equal(value.removed, undefined);
  assert.equal(mergeColumns('inbound', columns, {}).supplierName?.show, false);
});

test('列宽边界80–600，重置以列默认值恢复隐藏列', () => {
  assert.equal(clampWidth(10), 80);
  assert.equal(clampWidth(1000), 600);
  const columns = completeColumns('inbound', [{ dataIndex: 'receiptNo', width: 220 }]);
  assert.equal(mergeColumns('inbound', columns, {}).productModels?.width, 120);
});
