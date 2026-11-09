import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inventorySnapshot, failAfter } from '../../apps/api/tests/inventory-fixture';
import {
  e2eDatabase,
  loginInventory,
  inventoryCell,
  receipt,
  post,
  confirmReceipt,
  screenshotWidths,
} from './inventory-helpers';

test('B1a3 入库明确确认与同键重试，创建不入账', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await loginInventory(page);
    const cell = await inventoryCell(db);
    const created = await receipt(page, cell);
    expect((await db.get('SELECT packages FROM stock WHERE product_code=?', [cell.productCode]))?.packages).toBe(6);
    await page.goto(`/inbound/${created.id}`);
    await expect(page.getByText('待确认 · 尚未计入库存', { exact: true })).toBeVisible();
    await screenshotWidths(page, 'b1a3-inbound-confirm');
    const request = page.waitForRequest(
      (req) => req.url().endsWith(`/inbound/${created.id}/confirm`) && req.method() === 'POST',
    );
    await confirmReceipt(page, created.id);
    const key = (await request).headers()['idempotency-key']!;
    await expect(page.getByText('已确认入库', { exact: true })).toBeVisible();
    expect((await post(page, `/inbound/${created.id}/confirm`, {}, key)).status()).toBe(200);
    expect((await db.get('SELECT packages FROM stock WHERE product_code=?', [cell.productCode]))?.packages).toBe(7);
    expect((await db.all('SELECT id FROM stock_journal WHERE inbound_receipt_id=?', [created.id])).length).toBe(1);
    console.log('B1A3_E2E repeat_inbound_confirm=200 journal_rows=1 stock=6->7 created_stock_unchanged=true');
  } finally {
    await db.close();
  }
});

test('B1a3 调整空原因 422、库存不足 409；错误保留输入且数据库不变', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await loginInventory(page);
    const cell = await inventoryCell(db);
    const before = await inventorySnapshot(db);
    const empty = await post(page, '/stock/adjustments', {
      ...cell,
      expected: { packages: 6, weightGrams: 1800000 },
      packagesDelta: -1,
      weightDeltaGrams: 0,
      reason: ' ',
    });
    expect(empty.status()).toBe(422);
    await page.goto(`/stock?product=${encodeURIComponent(cell.productCode)}`);
    await page
      .getByTestId('stock-list')
      .getByRole('row')
      .filter({ hasText: cell.productCode })
      .getByRole('button', { name: '调整库存' })
      .click();
    await page.getByLabel('包数调整量', { exact: true }).fill('-7');
    await page.getByLabel('调整原因', { exact: true }).fill('核验库存不足时的恢复');
    const response = page.waitForResponse((res) => res.url().endsWith('/stock/adjustments'));
    await page.getByRole('button', { name: '确认调整库存' }).click();
    expect((await response).status()).toBe(409);
    await expect(page.getByText(/库存包数或实重不足，操作未执行/)).toBeVisible();
    await expect(page.getByLabel('调整原因', { exact: true })).toHaveValue('核验库存不足时的恢复');
    expect(await inventorySnapshot(db)).toEqual(before);
    console.log('B1A3_E2E empty_reason=422 insufficient=409 all_tables_unchanged=true input_preserved=true');
  } finally {
    await db.close();
  }
});

test('B1a3 事务末段失败：状态、库存、流水、审计及幂等全回滚，原键恢复', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await loginInventory(page);
    const cell = await inventoryCell(db);
    const created = await receipt(page, cell);
    const before = await inventorySnapshot(db);
    await failAfter(db, 'idempotent_commands', 'INSERT');
    const response = page.waitForResponse((res) => res.url().endsWith(`/inbound/${created.id}/confirm`));
    try {
      await confirmReceipt(page, created.id);
      expect((await response).status()).toBe(500);
    } finally {
      await db.run('DROP TRIGGER b1a_fail');
    }
    await expect(page.getByText(/操作失败可重试/)).toBeVisible();
    expect(await inventorySnapshot(db)).toEqual(before);
    const originalKey = (await response).request().headers()['idempotency-key']!;
    expect((await post(page, `/inbound/${created.id}/confirm`, {}, originalKey)).status()).toBe(200);
    console.log('B1A3_E2E fail_after=idempotent_commands status=500 all_tables_unchanged=true same_key_retry=200');
  } finally {
    await db.close();
  }
});

test('B1a3 跨单调整：不改两张单据，调整前后值与 SQL delta 一致', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await loginInventory(page);
    const cell = await inventoryCell(db);
    const first = await receipt(page, cell);
    const second = await receipt(page, cell);
    expect((await post(page, `/inbound/${first.id}/confirm`, {})).status()).toBe(200);
    await page.goto(`/stock?product=${encodeURIComponent(cell.productCode)}`);
    await page
      .getByTestId('stock-list')
      .getByRole('row')
      .filter({ hasText: cell.productCode })
      .getByRole('button', { name: '调整库存' })
      .click();
    await page.getByLabel('包数调整量', { exact: true }).fill('-1');
    await page.getByLabel('重量调整量（吨）', { exact: true }).fill('-0.2103');
    await page.getByLabel('调整原因', { exact: true }).fill('现场复核：按实物记录包数与总重量差异');
    await screenshotWidths(page, 'b1a3-stock-adjustment');
    const response = page.waitForResponse((res) => res.url().endsWith('/stock/adjustments'));
    await page.getByRole('button', { name: '确认调整库存' }).click();
    const saved = await response;
    expect(saved.status()).toBe(200);
    await expect(page.getByText('库存调整已入账', { exact: true })).toBeVisible();
    expect(
      (
        await post(
          page,
          '/stock/adjustments',
          saved.request().postDataJSON(),
          saved.request().headers()['idempotency-key']!,
        )
      ).status(),
    ).toBe(200);
    expect((await post(page, `/inbound/${second.id}/confirm`, {})).status()).toBe(200);
    expect(
      (await db.all('SELECT packages FROM inbound_lines WHERE receipt_id IN (?,?)', [first.id, second.id])).map(
        (row) => row.packages,
      ),
    ).toEqual([1, 1]);
    const sql = readFileSync('scripts/sql/verify-inventory-posting.sql', 'utf8');
    for (const statement of sql
      .replace(/^--.*$/gm, '')
      .split(';')
      .filter((part) => part.trim())) {
      const rows = await db.all(statement);
      expect(
        rows.every((row) => ('balanced' in row ? Number(row.balanced) === 1 : Number(row.mismatches) === 0)),
      ).toBeTruthy();
      console.log(`B1A3_E2E_SQL ${JSON.stringify(rows)}`);
    }
    console.log(`B1A3_E2E cross_document_adjustment=true operation=${(await saved.json()).data.operationId}`);
  } finally {
    await db.close();
  }
});
