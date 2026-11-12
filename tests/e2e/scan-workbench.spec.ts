import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { detailSchema } from '@wms/contracts';
import { test } from './list-test';
import { e2eDatabase, inventoryCell, post, screenshotWidths } from './inventory-helpers';
import { addV1Fixture } from '../../apps/api/tests/catalog-fixture';

test('B4g 清点三通道、人工归属、撤销与导出一致，带入可改且确认后只读', async ({ page }) => {
  test.setTimeout(120000);
  const db = e2eDatabase();
  try {
    const cell = await inventoryCell(db);
    const created = await post(page, '/outbound', {
      warehouseCode: cell.warehouseCode,
      customerCode: 'DEMO-CUST-1',
      vehicleNo: '清点验收',
      lines: [{ productCode: cell.productCode, plannedPackages: 4, plannedWeightGrams: 1200000 }],
    });
    expect(created.status()).toBe(200);
    const order = detailSchema.parse((await created.json()).data);
    const prefix = `B4G-${randomUUID().slice(0, 8)}`;
    const barcodes = [1, 2, 3].map((i) => `${prefix}-${i}`);
    for (const barcode of barcodes) await addV1Fixture(db, { barcode, product: 'UNMAPPED-SPEC', tonnes: '0.3000' });
    await page.goto(`/outbound/${order.id}`);
    await page.getByRole('button', { name: '清点工作台', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: /清点工作台/ });
    await drawer.getByLabel('条码或片段', { exact: true }).fill(barcodes[0]!);
    await drawer.getByLabel('条码或片段', { exact: true }).press('Enter');
    await expect(drawer.getByText('归属人工确认', { exact: true })).toHaveCount(1);
    await drawer.getByLabel('条码或片段', { exact: true }).fill(barcodes[1]!);
    await drawer.getByRole('button', { name: '查找候选' }).click();
    const candidate = drawer.locator('tr[data-row-key]').filter({ has: page.getByText(barcodes[1]!, { exact: true }) });
    await candidate.getByRole('checkbox').check();
    await drawer.getByRole('button', { name: '计入选中' }).click();
    await expect(drawer.getByText('候选选择', { exact: true })).toBeVisible();
    await drawer.getByText('批量粘贴', { exact: true }).click();
    await drawer.getByLabel('每行一个条码', { exact: true }).fill(`${barcodes[2]}\n${barcodes[0]}\nX`);
    await drawer.getByRole('button', { name: '检查并加入待录' }).click();
    await expect(drawer.getByText('有效 1 · 重复 1 · 无效 1', { exact: true })).toBeVisible();
    await drawer.getByRole('button', { name: '仅计入有效 1 条' }).click();
    await expect(drawer.getByText('已计入', { exact: true })).toBeVisible();
    await expect(drawer.getByRole('button', { name: '带入实发', exact: true })).toBeEnabled();
    await drawer.getByText('批量粘贴', { exact: true }).first().click();
    await drawer.getByLabel('条码或片段', { exact: true }).fill('');
    await drawer.locator('.ant-drawer-body').evaluate((element) => element.scrollTo(0, 0));
    await screenshotWidths(page, 'b4g-counting');
    await drawer.getByRole('button', { name: '撤销上一条' }).click();
    const confirm = page.getByRole('dialog', { name: '撤销这条清点记录' });
    await confirm.getByRole('button', { name: '确认撤销' }).click();
    await expect(confirm).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/v1/outbound/${order.id}/scan-summary`)).json()).data.recorded.packages,
      )
      .toBe(2);
    const downloading = page.waitForEvent('download');
    await drawer.getByRole('button', { name: '导出扫码清单', exact: true }).click();
    const download = await downloading;
    const path = '.local/evidence/b4g-counting-export.xlsx';
    await download.saveAs(path);
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(path);
    expect(book.worksheets[0]!.rowCount).toBe(4);
    expect(book.worksheets[0]!.getColumn(1).values).not.toContain(barcodes[2]);
    await drawer.getByRole('button', { name: '带入实发', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: '实发包数 1' })).toHaveValue('2');
    await page.getByRole('spinbutton', { name: '实发包数 1' }).fill('1');
    await page.getByRole('spinbutton', { name: '实发吨数 1' }).fill('0.3');
    await page.getByRole('button', { name: '核对并确认出库', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确认出库', exact: true }).click();
    await expect(page.getByRole('button', { name: '已确认出库' })).toBeDisabled();
    await page.getByRole('button', { name: '清点工作台', exact: true }).click();
    await expect(drawer.getByLabel('条码或片段', { exact: true })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: '撤销上一条' })).toBeDisabled();
    expect(await db.get('SELECT packages,weight_tonnes FROM stock WHERE product_code=?', [cell.productCode])).toEqual({
      packages: 5,
      weight_tonnes: '1.5000',
    });
    console.log(
      'B4G_E2E manual/search/paste=1/1/1 revoke=-1 export=2 prefill=2 actual=1 stock=5/1.5000 confirmed_readonly=true',
    );
  } finally {
    await db.close();
  }
});
