import { expect, type Page } from '@playwright/test';

export async function fillReceipt(page: Page) {
  await page.goto('/inbound/new');
  await page.getByLabel('供应商', { exact: true }).click();
  await page.getByTitle('合成供应商 · DEMO-SUPPLIER', { exact: true }).click();
  await page.getByLabel('仓库', { exact: true }).click();
  await page.getByTitle('合成仓库 · DEMO-WH', { exact: true }).click();
  await page.getByLabel('商品', { exact: true }).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'ACR-032' }).click();
  await page.getByLabel('包数', { exact: true }).fill('1');
  await page.getByLabel('本次总重量（吨）').fill('0.3025');
}
export async function expectRetained(page: Page) {
  await expect(page.getByLabel('包数', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('本次总重量（吨）')).toHaveValue('0.3025');
}
