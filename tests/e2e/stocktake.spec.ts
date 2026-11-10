import { expect } from '@playwright/test';
import { test } from './list-test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { stocktakeSchema } from '@wms/contracts';
import { e2eDatabase, post, receipt, screenshotWidths } from './inventory-helpers';
import { countCell, takeFor, readCount, countPreview } from './stocktake-helpers';
import { businessFingerprint } from '../../apps/api/tests/lifecycle-fixture';
import { injectStocktakeFailure } from '../../apps/api/tests/stocktake-fixture';

test('B3a Web 新建/实盘/未入账确认/故障恢复/重复回写/SQL', async ({ page }) => {
  test.setTimeout(120000);
  const db = e2eDatabase();
  try {
    const cell = await countCell(db);
    await page.goto('/stocktakes/new');
    await page.getByLabel('盘点仓库', { exact: true }).click();
    await page.getByLabel('盘点仓库', { exact: true }).fill(cell.warehouseCode);
    await page.getByTitle(`${cell.name} · ${cell.warehouseCode}`, { exact: true }).click();
    await screenshotWidths(page, 'b3a-new');
    const creation = page.waitForResponse((r) => r.url().endsWith('/stocktakes') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '开始盘点' }).click();
    const created = await creation;
    expect(created.status()).toBe(200);
    const take = stocktakeSchema.parse((await created.json()).data);
    await expect(page.getByText('未录', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: '录入', exact: true }).click();
    await page.getByLabel('实盘包数', { exact: true }).fill('5');
    await page.getByLabel('实盘总吨数', { exact: true }).fill('1.5231');
    await screenshotWidths(page, 'b3a-reading');
    await page.getByRole('button', { name: '保存实盘', exact: true }).click();
    await expect(page.getByText('-0.2769', { exact: true })).toBeVisible();
    await receipt(page, cell);
    expect(
      (
        await post(page, '/outbound', {
          warehouseCode: cell.warehouseCode,
          customerCode: 'DEMO-CUST-1',
          vehicleNo: '合成盘点预览',
          lines: [{ productCode: cell.productCode, plannedPackages: 2, plannedWeightGrams: 600000 }],
        })
      ).status(),
    ).toBe(200);
    await page.getByRole('button', { name: '核对差异并回写' }).click();
    const submit = page.getByRole('button', { name: '人工确认并回写库存', exact: true });
    await expect(submit).toBeDisabled();
    await page.getByLabel('回写原因', { exact: true }).fill('按盘点开始时实盘，已排除后续未入账收货');
    await page.getByRole('checkbox', { name: /按盘点开始时的数量回写/ }).check();
    await screenshotWidths(page, 'b3a-unposted-preview');
    const before = await businessFingerprint(db);
    await injectStocktakeFailure(db, 'operation_log', 'INSERT');
    let requestKey = '';
    try {
      const failure = page.waitForResponse((r) => r.url().endsWith(`/stocktakes/${take.id}/post`));
      await submit.click();
      const response = await failure;
      expect(response.status()).toBe(500);
      requestKey = response.request().headers()['idempotency-key']!;
      await expect(page.getByLabel('回写原因', { exact: true })).toHaveValue('按盘点开始时实盘，已排除后续未入账收货');
      await expect(submit).toHaveAttribute('aria-busy', 'false');
      await expect(submit).toBeEnabled();
      await page.screenshot({ path: '.local/evidence/b3a-post-failure-retry.png' });
      expect(await businessFingerprint(db)).toEqual(before);
    } finally {
      await db.run('DROP TRIGGER b3a_fail');
    }
    const success = page.waitForResponse((r) => r.url().endsWith(`/stocktakes/${take.id}/post`));
    await submit.click();
    const saved = await success;
    expect(saved.status()).toBe(200);
    expect(saved.request().headers()['idempotency-key']).toBe(requestKey);
    const repeated = await Promise.all(
      Array.from({ length: 20 }, () =>
        post(page, `/stocktakes/${take.id}/post`, saved.request().postDataJSON(), requestKey),
      ),
    );
    expect(repeated.map((r) => r.status())).toEqual(Array(20).fill(200));
    await expect(page.getByText('已回写完成', { exact: true })).toBeVisible();
    await screenshotWidths(page, 'b3a-completed');
    const results = [];
    for (const query of readFileSync('scripts/sql/verify-stocktake.sql', 'utf8')
      .replace(/^--.*$/gm, '')
      .split(';')
      .filter((s) => s.trim())) {
      const rows = await db.all(query);
      expect(rows.every((r) => ('balanced' in r ? Number(r.balanced) === 1 : Number(r.mismatches) === 0))).toBeTruthy();
      results.push(rows);
    }
    writeFileSync('.local/evidence/b3a-e2e-sql.json', JSON.stringify(results, null, 2));
    console.log(
      `B3A_E2E saved_input_preserved=true failure=500 partial_writes=0 same_retry_key=true repeated=${repeated.map((r) => r.status())} operations=1 sql_mismatches=0`,
    );
  } finally {
    await db.close();
  }
});
test('B3a 遗忘暂停409可见入口定位、作废不改库存，四态与窄屏', async ({ page }) => {
  test.setTimeout(90000);
  const db = e2eDatabase();
  try {
    const cell = await countCell(db),
      take = await takeFor(page, cell.warehouseCode),
      pending = await receipt(page, cell);
    await page.goto('/stocktakes?status=counting');
    await expect(page.getByRole('link', { name: take.number, exact: true })).toBeVisible();
    await screenshotWidths(page, 'b3a-list');
    await page.goto('/');
    await expect(page.getByTestId('active-stocktakes')).toContainText('1');
    const denied = await post(page, `/inbound/${pending.id}/confirm`, {});
    expect(denied.status()).toBe(409);
    expect((await denied.json()).message).toContain(take.number);
    await page.getByTestId('active-stocktakes').click();
    await expect(page).toHaveURL(`/stocktakes/${take.id}`);
    await expect(page.getByText(/进行中仅“作废盘点”可提前释放/)).toBeVisible();
    await screenshotWidths(page, 'b3a-forgotten-window');
    const before = await db.all('SELECT * FROM stock'),
      journal = await db.all('SELECT * FROM stock_journal');
    await page.getByRole('button', { name: '作废盘点', exact: true }).click();
    await page.getByLabel('作废原因', { exact: true }).fill('现场暂停，保留本次实盘记录');
    await page.getByRole('button', { name: '确认作废盘点', exact: true }).click();
    await expect(page.getByText('已作废', { exact: true })).toBeVisible();
    expect(await db.all('SELECT * FROM stock')).toEqual(before);
    expect(await db.all('SELECT * FROM stock_journal')).toEqual(journal);
    expect((await post(page, `/inbound/${pending.id}/confirm`, {})).status()).toBe(200);
    await page.goto('/stocktakes?status=counting');
    await expect(page.getByText('暂无盘点单，点击“新建盘点”开始。')).toBeVisible();
    await page.route('**/api/v1/stocktakes?*', (r) =>
      r.fulfill({
        status: 503,
        json: { code: 'UNAVAILABLE', message: '可恢复的测试错误', data: null, traceId: 'b3a-test' },
      }),
    );
    await page.reload();
    await expect(page.getByText('盘点数据加载失败')).toBeVisible();
    await page.unroute('**/api/v1/stocktakes?*');
    await page.getByRole('button', { name: /^重\s*试$/ }).click();
    await expect(page.getByText('暂无盘点单，点击“新建盘点”开始。')).toBeVisible();
    await page.route('**/api/v1/stocktakes?*', (r) =>
      r.fulfill({ status: 403, json: { code: 'FORBIDDEN', message: '无权限', data: null, traceId: 'b3a-test' } }),
    );
    await page.reload();
    await expect(page.getByText('此客户端无权盘点')).toBeVisible();
    await page.unroute('**/api/v1/stocktakes?*');
    console.log(
      'B3A_FORGOTTEN confirm=409 visible_entry_locates_document=true void_stock_delta=0 void_journals=0 after_void_confirm=200 error_retry=true denied_state=true',
    );
  } finally {
    await db.close();
  }
});
test('B3a HTTP 异键并发、422、过期预览、默认阻断无写入', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const cell = await countCell(db),
      take = await takeFor(page, cell.warehouseCode);
    await readCount(page, take.id, cell.productCode);
    const preview = await countPreview(page, take.id),
      input = { expectedToken: preview.token, reason: '并发盘点验收' };
    const before = await businessFingerprint(db);
    expect((await post(page, `/stocktakes/${take.id}/post`, { ...input, reason: ' ' })).status()).toBe(422);
    expect(await businessFingerprint(db)).toEqual(before);
    await receipt(page, cell);
    expect(
      (await post(page, `/stocktakes/${take.id}/post`, { ...input, acknowledgeSnapshotBasis: true })).status(),
    ).toBe(409);
    const fresh = await countPreview(page, take.id),
      body = { ...input, expectedToken: fresh.token };
    expect((await post(page, `/stocktakes/${take.id}/post`, body)).status()).toBe(409);
    const replies = await Promise.all(
      Array.from({ length: 20 }, () =>
        post(page, `/stocktakes/${take.id}/post`, { ...body, acknowledgeSnapshotBasis: true }, randomUUID()),
      ),
    );
    expect(replies.filter((r) => r.status() === 200)).toHaveLength(1);
    expect(replies.filter((r) => r.status() === 409)).toHaveLength(19);
    console.log(
      `B3A_HTTP blank_reason=422 stale_preview=409 unposted_without_ack=409 distinct_keys=${replies.map((r) => r.status())} successful_postings=1`,
    );
  } finally {
    await db.close();
  }
});
