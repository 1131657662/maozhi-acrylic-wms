import { expect } from '@playwright/test';
import { test } from './list-test';
import { publicStocktakeSchema } from '@wms/contracts';
import { e2eDatabase, post, screenshotWidths } from './inventory-helpers';
import { countCell } from './stocktake-helpers';
import { randomUUID } from 'node:crypto';
import { getStocktake } from '../../apps/api/src/features/stocktake/read-model';
import { voidStocktake } from '../../apps/api/src/features/stocktake/void';

test('B6e-1 Web盲盘创建、录入、打印隔离、导出、取消揭示及原键重试', async ({ page }) => {
  test.setTimeout(90000);
  const db = e2eDatabase();
  let stocktakeId: string | undefined;
  try {
    const cell = await countCell(db);
    await page.goto('/stocktakes/new');
    await page.getByLabel('盘点仓库', { exact: true }).fill(cell.warehouseCode);
    await page.getByTitle(`${cell.name} · ${cell.warehouseCode}`, { exact: true }).click();
    await page.getByLabel('盘点模式', { exact: true }).click();
    await page.getByTitle('盲盘', { exact: true }).click();
    await screenshotWidths(page, 'b6e-1-create');
    const creation = page.waitForResponse((r) => r.url().endsWith('/stocktakes') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '开始盘点', exact: true }).click();
    const take = publicStocktakeSchema.parse((await (await creation).json()).data);
    stocktakeId = take.id;
    expect(take.mode).toBe('blind');
    expect(take.visibility).toBe('hidden');
    await expect(page.getByText('盲盘 · 未揭示', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '核对并揭示', exact: true })).toBeDisabled();
    await expect(page.getByRole('columnheader', { name: /账面|差异|盘点开始时/ })).toHaveCount(0);
    await page.getByRole('button', { name: '录入', exact: true }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).not.toContainText('1.8000');
    await page.getByLabel('实盘包数', { exact: true }).fill('5');
    await page.getByLabel('实盘总吨数', { exact: true }).fill('1.5231');
    await screenshotWidths(page, 'b6e-1-reading');
    await page.getByRole('button', { name: '保存实盘', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('button', { name: '核对并揭示', exact: true })).toBeEnabled();
    await expect(page.getByText('5 / 1.5231', { exact: true })).toBeVisible();
    await screenshotWidths(page, 'b6e-1-hidden');
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('columnheader', { name: /账面|差异|盘点开始时/ })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('1.8000');
    await page.emulateMedia({ media: 'screen' });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出结果', exact: true }).click();
    expect((await download).suggestedFilename()).toContain('导出结果.xlsx');
    await page.getByRole('button', { name: '核对并揭示', exact: true }).click();
    await screenshotWidths(page, 'b6e-1-reveal-confirm');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^取\s*消$/ })
      .click();
    expect((await (await page.request.get(`/api/v1/stocktakes/${take.id}`)).json()).data.visibility).toBe('hidden');
    let originalKey = '';
    await page.route(
      `**/api/v1/stocktake/${take.id}/reveal`,
      async (route) => {
        originalKey = route.request().headers()['idempotency-key']!;
        await route.abort('failed');
      },
      { times: 1 },
    );
    await page.getByRole('button', { name: '核对并揭示', exact: true }).click();
    await page.getByRole('button', { name: '确认揭示', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(2);
    const revealed = page.waitForResponse((r) => r.url().endsWith(`/stocktake/${take.id}/reveal`));
    await page.getByRole('button', { name: '确认揭示', exact: true }).click();
    const result = await revealed;
    expect(result.status()).toBe(200);
    expect(result.request().headers()['idempotency-key']).toBe(originalKey);
    await expect(page.getByText('盲盘 · 已揭示', { exact: true })).toBeVisible();
    await expect(page.getByText('6 / 1.8000', { exact: true })).toBeVisible();
    await expect(page.getByText('-0.2769', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '核对差异并回写', exact: true })).toBeVisible();
    await expect(page.getByTestId('object-audit-timeline')).toContainText('揭示盘点账面');
    await expect(page.getByRole('columnheader')).toHaveText([
      '库存商品',
      '开始时库存（包 / 吨）',
      '实盘（包 / 吨）',
      '差异（包 / 吨）',
      '操作',
    ]);
    await page.reload();
    await expect(page.getByText('盲盘 · 已揭示', { exact: true })).toBeVisible();
    await expect(page.getByText('6 / 1.8000', { exact: true })).toBeVisible();
    await screenshotWidths(page, 'b6e-1-revealed');
    const current = (await (await page.request.get(`/api/v1/stocktakes/${take.id}`)).json()).data;
    expect(
      (
        await post(page, `/stocktakes/${take.id}/void`, {
          expectedRevision: current.revision,
          reason: '盲盘浏览器验收结束',
        })
      ).status(),
    ).toBe(200);
  } finally {
    if (stocktakeId) {
      const take = await getStocktake(db, stocktakeId);
      if (take.status === 'counting')
        await voidStocktake(db, {
          id: take.id,
          input: { expectedRevision: take.revision, reason: '盲盘用例释放自身窗口' },
          key: randomUUID(),
          actor: { username: 'owner', traceId: 'blind-e2e-cleanup' },
        });
    }
    await db.close();
  }
});
