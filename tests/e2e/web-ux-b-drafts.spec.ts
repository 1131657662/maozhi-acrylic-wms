import { expect } from '@playwright/test';
import { test } from './list-test';
import { fillReceipt } from './web-ux-b-helpers';

test('B 草稿：离开确认、恢复全部选择及商品数量、提交清除', async ({ page }) => {
  await fillReceipt(page);
  await page.getByLabel('备注', { exact: true }).fill('本机草稿验收');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('wms-form-draft:owner:inbound:new')))
    .toContain('本机草稿验收');
  await page.getByRole('menuitem').filter({ hasText: '出库工作台' }).click();
  await expect(page.locator('.ant-modal-confirm-title')).toHaveText('有未保存的修改');
  await expect.poll(() => page.locator('.ant-modal').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(410);
  await page.screenshot({ path: '.local/evidence/web-ux-b/leave-confirm-1440.png', fullPage: true });
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page).toHaveURL(/\/inbound\/new$/);
  await page.getByRole('menuitem').filter({ hasText: '出库工作台' }).click();
  await page.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/inbound/new');
  await page.getByRole('button', { name: /^恢\s*复$/ }).click();
  await expect(page.getByLabel('备注', { exact: true })).toHaveValue('本机草稿验收');
  await expect(page.getByLabel('包数', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('本次总重量（吨）')).toHaveValue('0.3025');
  await expect(page.getByTitle('合成供应商 · DEMO-SUPPLIER')).toBeVisible();
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  await expect(page).toHaveURL(/\/inbound\/(?!new)[^/]+$/);
  expect(await page.evaluate(() => localStorage.getItem('wms-form-draft:owner:inbound:new'))).toBeNull();
});
test('B 草稿：刷新原生提示，恢复日期；丢弃草稿不再提示', async ({ page }) => {
  await fillReceipt(page);
  let seen = false;
  page.once('dialog', async (dialog) => {
    seen = dialog.type() === 'beforeunload';
    await dialog.accept();
  });
  await page.reload();
  expect(seen).toBeTruthy();
  await page.getByRole('button', { name: /^恢\s*复$/ }).click();
  await expect(page.getByLabel('业务日期')).not.toHaveValue('');
  await page.getByRole('menuitem').filter({ hasText: '出库工作台' }).click();
  await page.getByRole('button', { name: '放弃修改', exact: true }).click();
  await page.goto('/inbound/new');
  await page.getByRole('button', { name: /^丢\s*弃$/ }).click();
  expect(await page.evaluate(() => localStorage.getItem('wms-form-draft:owner:inbound:new'))).toBeNull();
  await page.getByRole('menuitem').filter({ hasText: '出库工作台' }).click();
  await expect(page).toHaveURL(/\/$/);
});
test('B 草稿：还原到初始值不拦截，身份及单据隔离', async ({ page }) => {
  await page.goto('/inbound/new');
  await page.getByLabel('备注', { exact: true }).fill('临时修改');
  await page.getByLabel('备注', { exact: true }).fill('');
  await page.evaluate(() =>
    localStorage.setItem(
      'wms-form-draft:someone:inbound:new',
      JSON.stringify({ values: '{"memo":"其他人"}', time: '10:00' }),
    ),
  );
  await page.getByRole('menuitem').filter({ hasText: '出库工作台' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/outbound/new');
  await expect(page.getByText(/发现未提交的草稿/)).toHaveCount(0);
});
