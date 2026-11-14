import { expect, test, type Page } from '@playwright/test';
import { stockAdjustmentResultSchema, type StockAdjustmentResult } from '@wms/contracts';
import type { Database } from '../../apps/api/src/db/mysql';
import { e2eDatabase, inventoryCell, loginInventory, post, screenshotWidths } from './inventory-helpers';

type StockCell = Awaited<ReturnType<typeof inventoryCell>>;
interface AdjustmentSubmission {
  result: StockAdjustmentResult;
  body: unknown;
  key: string;
}

test('库存调整确认后余额、流水与审计一致且重放不重复', async ({ page }) => {
  const db = e2eDatabase();
  try {
    await loginInventory(page);
    const cell = await inventoryCell(db);
    const submission = await submitStockAdjustment(page, cell, db);
    await assertAdjustmentRecords(db, submission.result);
    const replay = await post(page, '/stock/adjustments', submission.body, submission.key);
    expect(replay.status()).toBe(200);
    expect(stockAdjustmentResultSchema.parse((await replay.json()).data)).toEqual(submission.result);
    await assertAdjustmentRecords(db, submission.result);
  } finally {
    await db.close();
  }
});

async function submitStockAdjustment(page: Page, cell: StockCell, db: Database): Promise<AdjustmentSubmission> {
  await page.goto(`/stock?product=${encodeURIComponent(cell.productCode)}`);
  const initialPeek = page.waitForResponse((res) => res.url().endsWith('/stock/peek'));
  await page.getByRole('button', { name: '展开最近流水' }).click();
  expect((await initialPeek).status()).toBe(200);
  await expect(page.getByTestId('stock-peek')).toContainText('该商品暂无流水');
  await page
    .getByTestId('stock-list')
    .getByRole('row')
    .filter({ hasText: cell.productCode })
    .getByRole('button', { name: '调整库存' })
    .click();
  await page.getByLabel('包数调整量', { exact: true }).fill('2');
  await page.getByLabel('重量调整量（吨）', { exact: true }).fill('0.25');
  await page.getByLabel('调整原因', { exact: true }).fill('合成验收：核对调整流水与审计');
  const requests: string[] = [];
  const trackRequest = (request: import('@playwright/test').Request) => {
    if (request.url().endsWith('/stock/adjustments') && request.method() === 'POST') requests.push(request.url());
  };
  page.on('request', trackRequest);
  const beforeCancel = await adjustmentRecords(db, cell);
  await page.getByRole('button', { name: '确认调整库存' }).click();
  const confirmation = page.getByRole('dialog', { name: '确认库存调整' });
  await expect(confirmation).toContainText('调整前：6 包 / 1.8000 吨');
  await expect(confirmation).toContainText('调整后：8 包 / 2.0500 吨');
  await expect(confirmation).toContainText('本次变化：+2 包 / +0.2500 吨');
  await expect(confirmation).toContainText('原因：合成验收：核对调整流水与审计');
  await screenshotWidths(page, 'b6f-2c-adjustment-confirm');
  await confirmation.getByRole('button', { name: /^取\s*消$/ }).click();
  await expect(confirmation).toBeHidden();
  expect(requests).toHaveLength(0);
  expect(await adjustmentRecords(db, cell)).toEqual(beforeCancel);
  let releaseSubmission!: () => void;
  const submitGate = new Promise<void>((resolve) => {
    releaseSubmission = resolve;
  });
  await page.route(
    '**/api/v1/stock/adjustments',
    async (route) => {
      await submitGate;
      await route.continue();
    },
    { times: 1 },
  );
  const response = page.waitForResponse((res) => res.url().endsWith('/stock/adjustments'));
  await page.getByRole('button', { name: '确认调整库存' }).click();
  await page.getByRole('button', { name: '确认提交' }).click();
  const submitting = confirmation.getByRole('button', { name: /提交中/ });
  await expect(submitting).toBeDisabled();
  await expect(submitting.getByRole('img', { name: 'loading' })).toBeVisible();
  await submitting.dispatchEvent('click');
  releaseSubmission();
  const saved = await response;
  expect(saved.status()).toBe(200);
  expect(requests).toHaveLength(1);
  page.off('request', trackRequest);
  const result = stockAdjustmentResultSchema.parse((await saved.json()).data);
  expect(result.before).toEqual({ packages: 6, weightGrams: 1800000 });
  expect(result.after).toEqual({ packages: 8, weightGrams: 2050000 });
  const row = page.getByTestId('stock-list').getByRole('row').filter({ hasText: cell.productCode });
  await expect(row.getByTestId('stock-row-packages')).toHaveText('8');
  await expect(row.getByTestId('stock-row-tonnes')).toHaveText('2.0500');
  await expect(page.getByRole('dialog', { name: '库存调整 · 库存商品' })).toBeHidden();
  const refreshedPeek = page.waitForResponse((res) => res.url().endsWith('/stock/peek'));
  await row.getByRole('button', { name: '展开最近流水' }).click();
  expect((await refreshedPeek).status()).toBe(200);
  await expect(page.getByTestId('stock-peek')).toContainText('库存调整');
  await expect(page.getByTestId('stock-peek').locator('tbody tr[data-row-key]')).toHaveCount(1);
  const journalRow = page
    .getByTestId('stock-recent-movements')
    .getByRole('row')
    .filter({ hasText: cell.productCode })
    .first();
  await expect(journalRow).toContainText('库存调整');
  await expect(journalRow.getByTestId('journal-row-packages')).toHaveText('2');
  await expect(journalRow.getByTestId('journal-row-tonnes')).toHaveText('0.2500');
  return {
    result,
    body: saved.request().postDataJSON(),
    key: saved.request().headers()['idempotency-key']!,
  };
}

async function assertAdjustmentRecords(db: Database, result: StockAdjustmentResult): Promise<void> {
  await assertStockBalance(db, result);
  await assertStockJournal(db, result);
  await assertStockAudit(db, result);
}

async function adjustmentRecords(db: Database, cell: StockCell) {
  const balance = await db.get('SELECT packages,weight_tonnes FROM stock WHERE warehouse_code=? AND product_code=?', [
    cell.warehouseCode,
    cell.productCode,
  ]);
  const journal = await db.get(
    'SELECT COUNT(*) AS count FROM stock_journal WHERE warehouse_code=? AND product_code=?',
    [cell.warehouseCode, cell.productCode],
  );
  const audit = await db.get(
    `SELECT COUNT(*) AS count FROM operation_log l
    JOIN inventory_operations o ON o.id=l.target_id
    WHERE l.action='stock.adjust' AND o.target_id=?`,
    [`${cell.warehouseCode}/${cell.productCode}`],
  );
  return {
    balance: { packages: Number(balance?.packages), weight: Number(balance?.weight_tonnes) },
    journal: Number(journal?.count),
    audit: Number(audit?.count),
  };
}

async function assertStockBalance(db: Database, result: StockAdjustmentResult): Promise<void> {
  const balance = await db.get('SELECT packages,weight_tonnes FROM stock WHERE warehouse_code=? AND product_code=?', [
    result.warehouseCode,
    result.productCode,
  ]);
  expect({ packages: Number(balance?.packages), tonnes: Number(balance?.weight_tonnes) }).toEqual({
    packages: result.after.packages,
    tonnes: 2.05,
  });
}

async function assertStockJournal(db: Database, result: StockAdjustmentResult): Promise<void> {
  const rows = await db.all(
    `SELECT packages_delta,tonnes_delta,packages_before,packages_after,tonnes_before,tonnes_after
    FROM stock_journal WHERE operation_id=?`,
    [result.operationId],
  );
  expect(rows).toHaveLength(1);
  expect({
    packagesDelta: Number(rows[0]?.packages_delta),
    tonnesDelta: Number(rows[0]?.tonnes_delta),
    packagesBefore: Number(rows[0]?.packages_before),
    packagesAfter: Number(rows[0]?.packages_after),
    tonnesBefore: Number(rows[0]?.tonnes_before),
    tonnesAfter: Number(rows[0]?.tonnes_after),
  }).toEqual({
    packagesDelta: 2,
    tonnesDelta: 0.25,
    packagesBefore: result.before.packages,
    packagesAfter: result.after.packages,
    tonnesBefore: 1.8,
    tonnesAfter: 2.05,
  });
}

async function assertStockAudit(db: Database, result: StockAdjustmentResult): Promise<void> {
  const rows = await db.all(
    "SELECT action,target_id,before_json,after_json FROM operation_log WHERE action='stock.adjust' AND target_id=?",
    [result.operationId],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.action).toBe('stock.adjust');
  expect(rows[0]?.target_id).toBe(result.operationId);
  expect(JSON.parse(String(rows[0]?.before_json))).toEqual(result.before);
  expect(stockAdjustmentResultSchema.parse(JSON.parse(String(rows[0]?.after_json)))).toEqual(result);
}
