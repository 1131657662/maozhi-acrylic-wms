import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { detailSchema } from '@wms/contracts';
import { e2eDatabase, inventoryCell, loginInventory, post, screenshotWidths } from './inventory-helpers';
import { addV1Fixture } from '../../apps/api/tests/catalog-fixture';
import { recordFact } from '../../apps/api/src/features/scan/service';
import { fact } from '../../apps/api/tests/fixture';

test('B4d 预填、修改实发、确认及扫码清单导出', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const cell = await inventoryCell(db);
    await loginInventory(page);
    const created = await post(page, '/outbound', {
      warehouseCode: cell.warehouseCode,
      customerCode: 'DEMO-CUST-1',
      vehicleNo: 'B4D-E2E',
      lines: [{ productCode: cell.productCode, plannedPackages: 2, plannedWeightGrams: 600000 }],
    });
    // Only request fields allowed by the creation contract.
    expect(created.status()).toBe(200);
    const order = detailSchema.parse((await created.json()).data);
    for (const grams of [302500, 297500]) {
      const barcode = `B4D-${randomUUID()}`;
      await addV1Fixture(db, { barcode, product: cell.productCode, tonnes: (grams / 1_000_000).toFixed(4) });
      await recordFact(db, {
        planId: order.id,
        fact: fact({ barcode, weightGrams: grams }),
        actor: { username: 'owner', channel: 'pda', traceId: 'b4d-e2e' },
      });
    }
    await page.goto(`/outbound/${order.id}`);
    await page.getByRole('button', { name: '按扫码预填', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '实发包数 1' })).toHaveValue('2');
    await page.getByRole('spinbutton', { name: '实发包数 1' }).fill('1');
    await page.getByRole('spinbutton', { name: '实发吨数 1' }).fill('0.2000');
    await screenshotWidths(page, 'b4d-actual');
    await page.getByRole('button', { name: '核对并确认出库', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('1 包 / 0.2000 吨');
    await expect(dialog).not.toContainText('扫码');
    await screenshotWidths(page, 'b4d-confirm');
    await dialog.getByRole('button', { name: '确认出库', exact: true }).click();
    await expect(page.getByText('部分发货', { exact: true }).first()).toBeVisible();
    const saved = await db.get('SELECT packages,weight_tonnes FROM stock WHERE product_code=?', [cell.productCode]);
    expect(saved).toEqual({ packages: 5, weight_tonnes: '1.6000' });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出扫码清单', exact: true }).click();
    const download = await downloadPromise;
    const path = '.local/evidence/b4d-scan-list.xlsx';
    await download.saveAs(path);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    const total = workbook.worksheets[0]!.getRow(4);
    expect([total.getCell(4).value, total.getCell(5).value, total.getCell(6).value]).toEqual([2, 600, 0.6]);
    await screenshotWidths(page, 'b4d-confirmed');
    const widths = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    console.log(
      `B4D_E2E prefill=2/0.6000 actual=1/0.2000 stock=5/1.6000 exported=2/0.6000 widths=${JSON.stringify(widths)}`,
    );
  } finally {
    await db.close();
  }
});
