import { expect } from '@playwright/test';
import { test } from './list-test';
import { randomUUID } from 'node:crypto';

test('B6a-num 三类基础资料系统发号、只读编码、改名、复制与名称优先下拉', async ({ page, context }) => {
  test.setTimeout(120000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const results: object[] = [];
  for (const [catalog, tab, pattern, selectLabel] of [
    ['customers', '客户', /^C\d{5}$/, '客户'],
    ['suppliers', '供应商', /^S\d{4}$/, '供应商'],
    ['warehouses', '仓库', /^W\d{2}$/, '仓库'],
  ] as const) {
    const name = `${tab}编号验收-${randomUUID().slice(0, 8)}`;
    await page.goto('/master-data');
    await page.getByRole('tab', { name: tab, exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: tab, exact: true });
    await panel.getByRole('button', { name: '新增基础资料' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('编码由系统生成')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: '编码', exact: true })).toHaveCount(0);
    await dialog.getByLabel('名称', { exact: true }).fill(name);
    const response = page.waitForResponse(
      (r) => r.url().endsWith(`/master/${catalog}`) && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: /保\s*存/ }).click();
    const created = await response;
    expect(created.status()).toBe(200);
    expect(created.request().postDataJSON()).not.toHaveProperty('code');
    const item = (await created.json()).data;
    expect(item.code).toMatch(pattern);
    await expect(dialog).toHaveCount(0);
    await panel.getByLabel('搜索基础资料').fill(item.code);
    await panel.getByLabel('搜索基础资料').press('Enter');
    const row = panel.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText(item.code);
    await row.getByRole('button', { name: '复制编码' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(item.code);
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(dialog.getByRole('textbox', { name: '编码', exact: true })).toHaveCount(0);
    await dialog.getByLabel('名称', { exact: true }).fill(`${name}已改名`);
    await dialog.getByRole('button', { name: /保\s*存/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toContainText(`${name}已改名`);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.screenshot({ path: `.local/evidence/b6a-num-${catalog}-1440.png`, fullPage: true });
    await page.goto(catalog === 'customers' ? '/outbound/new' : '/inbound/new');
    await page.getByLabel(selectLabel, { exact: true }).fill(item.code);
    const option = page.locator('.ant-select-item-option').filter({ hasText: item.code });
    await expect(option).toContainText(`${name}已改名`);
    await option.getByRole('button', { name: '复制编码' }).click();
    await expect(option).toBeVisible(); // Copy must not select or dismiss the dropdown.
    await option.getByText(`${name}已改名`, { exact: true }).click();
    await expect(
      page.locator('.ant-select').filter({ has: page.getByLabel(selectLabel, { exact: true }) }),
    ).toContainText(`${name}已改名`);
    results.push({ catalog, code: item.code, codeInput: false, renamed: true, copied: true, dropdown: true });
  }
  console.log('B6A_NUM_UI', JSON.stringify(results));
});

test('B6a-num 历史四位单号从列表可打开', async ({ page }) => {
  const number = 'RK-20260101-0088';
  const result = await page.request.post('/api/v1/inbound', {
    headers: { Origin: 'http://127.0.0.1:5174', 'Idempotency-Key': randomUUID() },
    data: {
      receiptNo: number,
      supplierCode: 'DEMO-SUPPLIER',
      warehouseCode: 'DEMO-WH',
      lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 302500 }],
    },
  });
  expect(result.status()).toBe(200);
  const item = (await result.json()).data;
  await page.goto(`/inbound?keyword=${number}`);
  await page.getByRole('link', { name: number, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/inbound/${item.id}$`));
  await expect(page.getByText(number, { exact: true }).first()).toBeVisible();
  console.log('B6A_NUM_OLD_NUMBER_UI', JSON.stringify({ number, detailOpened: true }));
});
