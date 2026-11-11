import { expect, type Page } from '@playwright/test';
import { detailSchema, inboundReceiptSchema } from '@wms/contracts';
import { test } from './list-test';
import { fillReceipt } from './web-ux-b-helpers';
import { screenRows, downloadAndCompare } from './export-helpers';

async function selectType(page: Page, label: string) {
  await page.getByLabel('单据类型', { exact: true }).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).click();
}

async function exportFiltered(
  page: Page,
  input: { kind: 'inbound' | 'outbound'; number: string; type: string; label: string },
) {
  const path = input.kind === 'inbound' ? '/inbound' : '/';
  await page.goto(`${path}?keyword=${encodeURIComponent(input.number)}&billType=${input.type}`);
  const list = page.getByTestId(input.kind + '-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(1);
  await expect(list.locator('td[data-export-field="billType"]')).toHaveText(input.label);
  const expected = await screenRows(page, input.kind);
  await list.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('button', { name: '生成 XLSX', exact: true }).click();
  await downloadAndCompare(page, { kind: input.kind, scope: 'b4e-type', expected });
}

test('B4e 入库表单保存类型、柜号和行备注，导出与筛选屏幕一致', async ({ page }) => {
  test.setTimeout(60000);
  await fillReceipt(page);
  await expect(
    page.locator('.ant-form-item').filter({ has: page.getByLabel('单据类型', { exact: true }) }),
  ).toContainText('采购入库');
  await selectType(page, '退货入库');
  await page.getByLabel('柜号', { exact: true }).fill('B4E-入柜');
  await page.getByLabel('行备注', { exact: true }).fill('B4E-入库行备注');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.local/evidence/b4e-inbound-form-1440.png', fullPage: true, animations: 'disabled' });
  const pending = page.waitForResponse((r) => r.url().endsWith('/api/v1/inbound') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const receipt = inboundReceiptSchema.parse((await response.json()).data);
  expect(receipt).toMatchObject({ billType: 'return', containerNo: 'B4E-入柜', lines: [{ memo: 'B4E-入库行备注' }] });
  await expect(page).toHaveURL(`/inbound/${receipt.id}`);
  await expect(page.getByText('退货入库', { exact: true })).toBeVisible();
  await expect(page.getByText('B4E-入柜', { exact: true })).toBeVisible();
  await expect(page.getByText('B4E-入库行备注', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: '.local/evidence/b4e-inbound-detail-1440.png',
    fullPage: true,
    animations: 'disabled',
  });
  await exportFiltered(page, { kind: 'inbound', number: receipt.receiptNo, type: 'return', label: '退货入库' });
});

async function fillPlan(page: Page) {
  await page.goto('/outbound/new');
  await page.getByLabel('客户', { exact: true }).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'DEMO-CUST-1' }).click();
  await page.getByLabel('仓库', { exact: true }).click();
  await page.getByTitle('合成仓库 · DEMO-WH', { exact: true }).click();
  await page.getByLabel('商品', { exact: true }).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'ACR-032' }).click();
  await page.getByLabel('计划包数', { exact: true }).fill('1');
  await page.getByLabel('计划重量（吨）', { exact: true }).fill('0.3025');
  await page.getByLabel('车牌', { exact: true }).fill('B4E-出库车');
  await page.getByLabel('柜号', { exact: true }).fill('B4E-出柜');
  await page.getByLabel('合同号', { exact: true }).fill('B4E-合同');
  await page.getByLabel('行备注', { exact: true }).fill('B4E-出库行备注');
}

test('B4e 出库表单与编辑保存扩展信息，保留商品和数量，导出类型一致', async ({ page }) => {
  test.setTimeout(60000);
  await fillPlan(page);
  const creating = page.waitForResponse((r) => r.url().endsWith('/api/v1/outbound') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '创建计划', exact: true }).click();
  const response = await creating;
  expect(response.status()).toBe(200);
  const plan = detailSchema.parse((await response.json()).data);
  expect(plan).toMatchObject({
    billType: 'sales',
    containerNo: 'B4E-出柜',
    lines: [{ contractNo: 'B4E-合同', memo: 'B4E-出库行备注' }],
  });
  await expect(page).toHaveURL(`/outbound/${plan.id}`);
  await page.getByRole('button', { name: '编辑计划', exact: true }).click();
  await expect(page.getByLabel('计划包数', { exact: true })).toHaveCount(0);
  await selectType(page, '样品出库');
  await page.getByLabel('柜号', { exact: true }).fill('B4E-新柜号');
  await page.getByLabel('合同号', { exact: true }).fill('B4E-新合同');
  await page.getByLabel('行备注', { exact: true }).fill('B4E-新行备注');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '.local/evidence/b4e-outbound-edit-1440.png', fullPage: true, animations: 'disabled' });
  const updating = page.waitForResponse(
    (r) => r.url().endsWith(`/api/v1/outbound/${plan.id}`) && r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  const edited = await updating;
  expect(edited.status()).toBe(200);
  const result = detailSchema.parse((await edited.json()).data);
  expect(result).toMatchObject({
    billType: 'sample',
    containerNo: 'B4E-新柜号',
    lines: [
      {
        id: plan.lines[0]!.id,
        productCode: 'ACR-032',
        plannedPackages: 1,
        plannedWeightGrams: 302500,
        contractNo: 'B4E-新合同',
        memo: 'B4E-新行备注',
      },
    ],
  });
  await expect(page.getByText('B4E-新合同', { exact: true })).toBeVisible();
  await expect(page.getByText('B4E-新行备注', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: '.local/evidence/b4e-outbound-detail-1440.png',
    fullPage: true,
    animations: 'disabled',
  });
  await exportFiltered(page, { kind: 'outbound', number: plan.orderNo, type: 'sample', label: '样品出库' });
});
