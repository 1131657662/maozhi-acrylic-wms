import { expect } from '@playwright/test';
import { test } from './list-test';
import { mixedInbound } from './b6b-selection-fixture';
import { screenRows, downloadAndCompare } from './export-helpers';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

test('B6b 历史单可选择导出，撤销排除历史单并解释原因', async ({ page }) => {
  const { prefix, documents } = await mixedInbound();
  await page.goto(`/inbound?keyword=${prefix}&sortBy=receiptNo&direction=asc`);
  const list = page.getByTestId('inbound-list');
  await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(3);
  const expected = await screenRows(page, 'inbound');
  const historical = list.locator(`tr[data-row-key="${documents[0]!.id}"]`).getByRole('checkbox');
  await historical.check();
  const batch = page.getByTestId('inbound-batch-actions');
  await expect(batch.getByRole('status')).toHaveText('可撤销 0 张 · 不可撤销 1 张（历史导入单据）');
  await expect(batch.getByRole('button', { name: '批量撤销', exact: true })).toBeDisabled();
  for (const document of documents.slice(1))
    await list.locator(`tr[data-row-key="${document.id}"]`).getByRole('checkbox').check();
  await expect(batch.getByRole('status')).toHaveText('可撤销 1 张 · 不可撤销 2 张（历史导入单据）');
  await list.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('radio', { name: '选中记录 · 3 单' }).check();
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  await downloadAndCompare(page, { kind: 'inbound', scope: 'mixed-history', expected });
  await page.keyboard.press('Escape');
  await batch.getByRole('button', { name: '批量撤销', exact: true }).click();
  for (const document of documents.slice(0, 2))
    await expect(page.getByTestId('batch-excluded')).toContainText(`${document.number}：历史导入单据`);
  const completed = page.waitForResponse((r) => r.url().endsWith('/web/lifecycle/batch-reverse'));
  await page.getByRole('button', { name: '确认批量撤销', exact: true }).click();
  const response = await completed;
  expect(
    response
      .request()
      .postDataJSON()
      .items.map((item: { id: string }) => item.id),
  ).toEqual([documents[2]!.id]);
  expect((await response.json()).data).toMatchObject({ total: 1, succeeded: 1, failed: 0 });
  console.log('B6B_SELECTION selected=3 exported=3 reversed=1 excluded=2 reason=历史导入单据');
});

for (const kind of ['inbound', 'outbound'])
  test(`B6b ${kind} 三次点击取消排序，默认排序跨页保持`, async ({ page }) => {
    const db = e2eDatabase();
    try {
      await seedListEvidence(db);
    } finally {
      await db.close();
    }
    const url = kind === 'inbound' ? '/inbound?keyword=WL-RK-' : '/?keyword=WL-CK-';
    await page.goto(url);
    const list = page.getByTestId(kind + '-list');
    const rows = list.locator('tbody tr[data-row-key]');
    await expect(rows).toHaveCount(50);
    const original = await rows.evaluateAll((elements) => elements.map((e) => e.getAttribute('data-row-key')));
    const header = list.getByRole('columnheader', { name: kind === 'inbound' ? '入库单号' : '出库单号', exact: true });
    for (const direction of ['asc', 'desc']) {
      await header.click();
      await expect(page).toHaveURL(new RegExp(`direction=${direction}`));
    }
    await header.click();
    await expect(page).not.toHaveURL(/sortBy|direction/);
    await expect
      .poll(() => rows.evaluateAll((elements) => elements.map((e) => e.getAttribute('data-row-key'))))
      .toEqual(original);
    await expect(list.locator('.ant-table-column-sorter .active')).toHaveCount(0);
    await list.locator('li[title="2"]').click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).not.toHaveURL(/sortBy|direction/);
    const response = await page.request.get(
      `/api/v1/web/lists/${kind}?keyword=WL-${kind === 'inbound' ? 'RK' : 'CK'}-&page=2&pageSize=50`,
    );
    const expected = (await response.json()).data.items.map((row: { id: string }) => row.id);
    await expect
      .poll(() => rows.evaluateAll((elements) => elements.map((e) => e.getAttribute('data-row-key'))))
      .toEqual(expected);
    for (const label of kind === 'inbound' ? ['原始状态', '入账状态'] : ['状态']) {
      await expect(
        list.getByRole('columnheader', { name: label, exact: true }).locator('.ant-table-column-sorter'),
      ).toHaveCount(0);
    }
  });
