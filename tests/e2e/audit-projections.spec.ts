import { expect } from '@playwright/test';
import { test } from './list-test';
import { post, screenshotWidths } from './inventory-helpers';

test('B6c-2 safe details load raw only after expansion and object timelines include failed attempts', async ({
  page,
}) => {
  const create = await post(page, '/inbound', {
    supplierCode: 'DEMO-SUPPLIER',
    warehouseCode: 'DEMO-WH',
    lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 300000 }],
  });
  expect(create.status()).toBe(200);
  const receipt = (await create.json()).data;
  const invalid = await post(page, `/inbound/${receipt.id}/confirm`, { weightGrams: '' });
  expect(invalid.status()).toBe(422);
  expect((await post(page, `/inbound/${receipt.id}/confirm`, {})).status()).toBe(200);
  const rawRequests: string[] = [];
  page.on('request', (req) => {
    if (/\/audit\/[^/]+\/raw/.test(req.url())) rawRequests.push(req.url());
  });
  await page.goto(`/audit?target=${receipt.receiptNo}`);
  const list = page.getByTestId('audit-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(3);
  await screenshotWidths(page, 'b6c-2-list');
  await list.getByRole('button', { name: '查看详情' }).first().click();
  await expect(page.getByRole('dialog').getByText(receipt.receiptNo, { exact: true })).toBeVisible();
  expect(rawRequests).toHaveLength(0);
  await page.getByRole('dialog').getByText('原始数据', { exact: true }).click();
  await expect(page.getByTestId('audit-raw')).toBeVisible();
  expect(rawRequests).toHaveLength(1);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载诊断记录' }).click();
  expect(await (await download).failure()).toBeNull();
  await page.keyboard.press('Escape');
  await page.getByText('时间线', { exact: true }).click();
  await expect(page.getByTestId('audit-timeline').getByText('失败', { exact: true })).toBeVisible();
  await screenshotWidths(page, 'b6c-2-timeline');
  await page.goto(`/inbound/${receipt.id}`);
  const timeline = page.getByTestId('object-audit-timeline');
  await expect(timeline.getByText('失败', { exact: true })).toBeVisible();
  await expect(timeline.getByText('填写内容或格式不正确', { exact: true })).toBeVisible();
  console.log('B6C2_UI raw_before_expand=0 raw_after_expand=1 download=complete object_failure=visible');
});
