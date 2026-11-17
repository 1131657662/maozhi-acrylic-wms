import { expect } from '@playwright/test';
import { test } from './list-test';

test('B7b root workbench and legacy outbound query/hash compatibility', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible();
  await page.goto('/?keyword=WL-CK-&status=open&page=2&pageSize=20#rows');
  await expect(page).toHaveURL('/outbound?keyword=WL-CK-&status=open&page=2&pageSize=20#rows');
  await expect(page.getByRole('heading', { name: '出库列表', exact: true })).toBeVisible();
  await page.goto('/outbound/new');
  await page.getByRole('button', { name: /取\s*消/, exact: true }).click();
  await expect(page).toHaveURL('/outbound');
});
test('B7b AuthGate preserves a legacy list destination through login', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/?keyword=WL-CK-&page=2#rows');
  await expect(page).toHaveURL(/\/user\/login\?redirect=/);
  const target = new URL(page.url()).searchParams.get('redirect');
  expect(target).toBe('/outbound?keyword=WL-CK-&page=2#rows');
  await page.getByLabel('用户名', { exact: true }).fill('owner');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL('/outbound?keyword=WL-CK-&page=2#rows');
});
