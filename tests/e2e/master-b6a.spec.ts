import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { randomUUID } from 'node:crypto';

async function choose(page: Page, label: string, code: string) {
  await page.getByLabel(label, { exact: true }).fill(code);
  await page.locator('.ant-select-item-option').filter({ hasText: code }).click();
}
test('B6a 新建商品立即回填入出库，改名后开始时库存保留；1440/1280资料抽屉', async ({ page }) => {
  test.setTimeout(90000);
  const code = `UI-${randomUUID().slice(0, 8)}`;
  await page.goto('/inbound/new');
  await choose(page, '供应商', 'DEMO-SUPPLIER');
  await choose(page, '仓库', 'DEMO-WH');
  const productItem = page
    .locator('.ant-form-item')
    .filter({ has: page.getByLabel('商品', { exact: true }) })
    .first();
  await productItem.getByRole('button', { name: '新增基础资料' }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByLabel('编码', { exact: true }).fill(code);
  await drawer.getByLabel('名称', { exact: true }).fill('界面新建腈纶');
  await drawer.getByLabel('型号', { exact: true }).fill('冻结型号甲');
  await drawer.getByRole('button', { name: /保\s*存/ }).click();
  await expect(drawer).toHaveCount(0);
  await expect(productItem).toContainText(`界面新建腈纶${code}`);
  await page.getByLabel('包数', { exact: true }).fill('2');
  await page.getByLabel('本次总重量（吨）').fill('0.5');
  const receiptResponse = page.waitForResponse((r) => r.url().endsWith('/inbound') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '创建待确认入库单' }).click();
  const receipt = await (await receiptResponse).json();
  expect(receipt.code).toBe('OK');
  await expect(page.getByText('冻结型号甲', { exact: true })).toBeVisible();
  await page.goto('/outbound/new');
  await choose(page, '商品', code);
  await expect(
    page.locator('.ant-select-content').filter({ has: page.getByLabel('商品', { exact: true }) }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.goto('/master-data');
  await page.getByLabel('搜索基础资料').fill(code);
  await page.getByLabel('搜索基础资料').press('Enter');
  await expect(page.getByRole('cell').filter({ hasText: code })).toBeVisible();
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      animations: 'disabled',
      path: `.local/evidence/b6a/master-list-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      animations: 'disabled',
      path: `.local/evidence/b6a/master-editor-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('界面改名腈纶');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /保\s*存/ })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`/inbound/${receipt.data.id}`);
  await expect(page.getByText('界面新建腈纶', { exact: true })).toBeVisible();
  console.log(
    'B6A_UI_PRODUCT',
    JSON.stringify({ code, inbound: receipt.data.receiptNo, outboundSelectable: true, oldNamePreserved: true }),
  );
});

test('B6a 收货档案默认切换停用，出库表单正确带出', async ({ page }) => {
  test.setTimeout(90000);
  const created = await page.request.post('/api/v1/master/customers', {
    headers: { Origin: 'http://127.0.0.1:5174' },
    data: { name: '收货档案验收客户' },
  });
  expect(created.status()).toBe(200);
  const code = (await created.json()).data.code as string;
  await page.goto('/outbound/new');
  await choose(page, '客户', code);
  await page.getByRole('button', { name: '管理档案' }).click();
  for (const name of ['甲', '乙', '丙']) {
    await page.getByRole('button', { name: '新增档案', exact: true }).click();
    const editor = page.getByRole('dialog').last();
    await editor.getByLabel('联系人', { exact: true }).fill(name);
    await editor.getByLabel('电话', { exact: true }).fill('13800000000');
    await editor.getByLabel('地址', { exact: true }).fill(`${name}地址`);
    await editor.getByRole('button', { name: /保\s*存/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  }
  const dialog = page.getByRole('dialog');
  for (const name of ['甲', '乙']) {
    await dialog.getByRole('radio', { name: `设为默认 ${name}`, exact: true }).click();
    await expect(dialog.getByRole('radio', { name: `设为默认 ${name}`, exact: true })).toBeChecked();
  }
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      animations: 'disabled',
      path: `.local/evidence/b6a/contacts-${width}.png`,
      fullPage: true,
    });
  }
  await dialog.getByRole('button', { name: /完\s*成/ }).click();
  await expect(page.getByText('乙地址', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '管理档案' }).click();
  await dialog
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: '乙', exact: true }) })
    .getByRole('button', { name: '停用' })
    .click();
  await page.getByRole('button', { name: /确\s*认/ }).click();
  await expect(dialog.getByRole('radio', { name: '设为默认 乙', exact: true })).toBeDisabled();
  await dialog.getByRole('radio', { name: '设为默认 丙', exact: true }).click();
  await dialog.getByRole('button', { name: /完\s*成/ }).click();
  await expect(page.getByText('丙地址', { exact: false })).toBeVisible();
  console.log('B6A_UI_CONTACTS', JSON.stringify({ contacts: 3, default: '甲→乙', disabled: '乙', formDefault: '丙' }));
});
