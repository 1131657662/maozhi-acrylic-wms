import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { fillReceipt } from './web-ux-b-helpers';
import { e2eDatabase, receipt } from './inventory-helpers';

async function countReceipts(memo: string) {
  const db = e2eDatabase();
  try {
    return Number((await db.get('SELECT COUNT(*) AS n FROM inbound_receipts WHERE memo=?', [memo]))?.n);
  } finally {
    await db.close();
  }
}
function evidence(name: string, value: unknown) {
  writeFileSync(`.local/evidence/web-ux-b/submit-${name}.json`, JSON.stringify(value, null, 2));
}
async function prepare(page: Page) {
  await fillReceipt(page);
  const memo = `B防重复-${randomUUID()}`;
  await page.getByLabel('备注', { exact: true }).fill(memo);
  return memo;
}
test('B 提交：同一轮连点 10 次只创建一单，提交中禁用', async ({ page }) => {
  const memo = await prepare(page);
  let count = 0,
    release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/inbound', async (route) => {
    count++;
    const response = await route.fetch();
    await pending;
    await route.fulfill({ response });
  });
  const submit = page.getByRole('button', { name: '创建待确认入库单', exact: true });
  await submit.evaluate((button) => {
    for (let i = 0; i < 10; i++) (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole('button', { name: /提交中/ })).toBeDisabled();
  await page.screenshot({
    path: '.local/evidence/web-ux-b/submitting-1440.png',
    fullPage: true,
    animations: 'disabled',
  });
  release();
  await expect(page).toHaveURL(/\/inbound\/(?!new)[^/]+$/);
  expect(count).toBe(1);
  expect(await countReceipts(memo)).toBe(1);
  evidence('click', { clicks: 10, requests: count, records: await countReceipts(memo) });
});
test('B 提交：服务端已成功但响应超时，重试同键仍一单', async ({ page }) => {
  test.setTimeout(65000);
  const memo = await prepare(page),
    keys: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/inbound', async (route) => {
    keys.push(route.request().headers()['idempotency-key']!);
    const response = await route.fetch();
    if (keys.length === 1) await held;
    await route.fulfill({ response }).catch(() => undefined);
  });
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  await expect(page.getByText('服务响应超时，本次操作未完成', { exact: true }).first()).toBeVisible({ timeout: 35000 });
  expect(await countReceipts(memo)).toBe(1);
  release();
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  await expect(page).toHaveURL(/\/inbound\/(?!new)[^/]+$/);
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(1);
  expect(await countReceipts(memo)).toBe(1);
  evidence('timeout', { attempts: keys.length, uniqueKeys: new Set(keys).size, records: await countReceipts(memo) });
});
test('B 提交：按住回车的 repeat 不产生第二次提交', async ({ page }) => {
  const memo = await prepare(page);
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/inbound')) count++;
  });
  const button = page.getByRole('button', { name: '创建待确认入库单', exact: true });
  await button.focus();
  await page.keyboard.down('Enter');
  for (let i = 0; i < 10; i++) await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(page).toHaveURL(/\/inbound\/(?!new)[^/]+$/);
  expect(count).toBe(1);
  expect(await countReceipts(memo)).toBe(1);
  evidence('enter', { repeatEvents: 10, requests: count, records: await countReceipts(memo) });
});
test('B 提交：双击确认入库只入账一次', async ({ page }) => {
  const item = await receipt(page, { productCode: 'ACR-032', warehouseCode: 'DEMO-WH' });
  let count = 0;
  page.on('request', (r) => {
    if (r.url().endsWith(`/inbound/${item.id}/confirm`)) count++;
  });
  await page.goto(`/inbound/${item.id}`);
  await page.getByRole('button', { name: '核对并确认入库' }).click();
  await page.getByRole('button', { name: '确认入账', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByText('已确认入库', { exact: true })).toBeVisible();
  const db = e2eDatabase();
  try {
    const operations = Number(
      (
        await db.get(
          "SELECT COUNT(*) AS n FROM inventory_operations WHERE target_id=? AND operation_type='inbound.confirm'",
          [item.id],
        )
      )?.n,
    );
    expect(count).toBe(1);
    expect(operations).toBe(1);
    evidence('confirm', { clicks: 2, requests: count, operations });
  } finally {
    await db.close();
  }
});

test('B 提交：确认失败保留中文提示，重试同键且无未处理异常', async ({ page }) => {
  const item = await receipt(page, { productCode: 'ACR-032', warehouseCode: 'DEMO-WH' });
  const errors: string[] = [],
    keys: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(`**/inbound/${item.id}/confirm`, async (route) => {
    keys.push(route.request().headers()['idempotency-key']!);
    if (keys.length === 1) await route.fulfill({ status: 503, body: 'unavailable' });
    else await route.continue();
  });
  await page.goto(`/inbound/${item.id}`);
  await page.getByRole('button', { name: '核对并确认入库' }).click();
  await page.getByRole('button', { name: '确认入账', exact: true }).click();
  await expect(page.locator('.ant-alert').filter({ hasText: '服务暂时不可用，请稍后重试' })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认入账', exact: true })).toBeHidden();
  await page.getByRole('button', { name: '核对并确认入库' }).click();
  await page.getByRole('button', { name: '确认入账', exact: true }).click();
  await expect(page.getByText('已确认入库', { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(1);
  expect(errors).toEqual([]);
});
