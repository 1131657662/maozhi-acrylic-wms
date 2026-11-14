import { expect } from '@playwright/test';
import { test } from './list-test';
import { randomUUID } from 'node:crypto';
import { detailSchema, stocktakeCopy } from '@wms/contracts';
import { e2eDatabase, post, screenshotWidths } from './inventory-helpers';
import { countCell, takeFor, readCount } from './stocktake-helpers';
import { registerPending } from '../../apps/api/tests/stocktake-integrity-fixture';
import { fact } from '../../apps/api/tests/fixture';

test('B6e-3 部分发货ACK显示未收妥；计划变化拒绝回写，刷新清除旧勾选后可完成', async ({ page }) => {
  test.setTimeout(120000);
  const db = e2eDatabase();
  let takeId: string | undefined;
  try {
    const cell = await countCell(db);
    const created = await post(page, '/outbound', {
      warehouseCode: cell.warehouseCode,
      customerCode: 'DEMO-CUST-1',
      vehicleNo: '盘点清单验收',
      lines: [{ productCode: cell.productCode, plannedPackages: 4, plannedWeightGrams: 1200000 }],
    });
    expect(created.status()).toBe(200);
    const order = detailSchema.parse((await created.json()).data);
    const shipped = await post(page, `/outbound/${order.id}/shipments`, {
      revision: order.revision,
      digest: order.digest,
      lines: [{ lineId: order.lines[0]!.id, actualPackages: 1, actualWeightGrams: 300000 }],
    });
    expect(shipped.status()).toBe(200);
    const partial = detailSchema.parse((await shipped.json()).data);
    await registerPending(db, partial, [fact()]);
    const take = await takeFor(page, cell.warehouseCode);
    takeId = take.id;
    await readCount(page, take.id, cell.productCode);
    await page.goto(`/stocktakes/${take.id}`);
    await page.getByRole('button', { name: '核对差异并回写' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText(stocktakeCopy.unpostedTitle, { exact: false })).toBeVisible();
    const row = drawer.getByRole('row').filter({ hasText: order.orderNo });
    await expect(row).toBeVisible();
    await expect(drawer.getByRole('columnheader', { name: stocktakeCopy.unreceivedRecords })).toBeVisible();
    await expect(row.getByRole('cell', { name: '1', exact: true })).toBeVisible();
    await expect(page.getByLabel('回写原因', { exact: true })).toBeVisible();
    await screenshotWidths(page, 'b6e-3-unposted');
    await page.getByLabel('回写原因', { exact: true }).fill('已核对部分发货及待补传');
    const ack = page.getByRole('checkbox', { name: /按盘点开始时的数量回写/ });
    await ack.check();
    const changed = await page.request.patch(`/api/v1/outbound/${order.id}/plan`, {
      headers: { Origin: 'http://127.0.0.1:5174', 'Idempotency-Key': randomUUID() },
      data: { revision: partial.revision, digest: partial.digest, plan: { memo: '预览后计划备注变更' } },
    });
    expect(changed.status()).toBe(200);
    const submit = page.getByRole('button', { name: '人工确认并回写库存', exact: true });
    const rejected = page.waitForResponse((r) => r.url().endsWith(`/stocktakes/${take.id}/post`));
    await submit.click();
    const conflict = await rejected;
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).message).toBe(stocktakeCopy.staleChecklist);
    await expect(drawer.getByRole('alert').filter({ hasText: '该单据已被修改，请刷新后重试' })).toBeVisible();
    await expect(page.getByLabel('回写原因', { exact: true })).toHaveValue('已核对部分发货及待补传');
    await page.getByRole('button', { name: '刷新回写预览' }).click();
    await expect(ack).not.toBeChecked();
    await expect(submit).toBeDisabled();
    await ack.check();
    await submit.click();
    await expect(page.getByText('已回写完成', { exact: true })).toBeVisible();
  } finally {
    if (takeId) {
      const take = await db.get('SELECT status,revision FROM stocktakes WHERE id=?', [takeId]);
      if (take?.status === 'counting')
        await post(page, `/stocktakes/${takeId}/void`, {
          expectedRevision: Number(take.revision),
          reason: '隔离用例结束保留记录并释放窗口',
        });
    }
    await db.close();
  }
});
