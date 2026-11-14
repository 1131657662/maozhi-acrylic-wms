import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { test } from './list-test';
import { e2eDatabase, post, screenshotWidths } from './inventory-helpers';
import { countCell, readCount } from './stocktake-helpers';
import { buildMasterSearchText } from '../../apps/api/src/features/master-data/search-text';
import { getStocktake } from '../../apps/api/src/features/stocktake/read-model';
import { voidStocktake } from '../../apps/api/src/features/stocktake/void';

test('B6e-2 盲盘登记发现商品、冲突保留、编辑删除、揭示回写后只读', async ({ page }) => {
  test.setTimeout(120000);
  const db = e2eDatabase(),
    code = `DISC-${randomUUID().slice(0, 8)}`,
    name = '新发现腈纶';
  let takeId: string | undefined;
  try {
    const cell = await countCell(db);
    await db.run(
      `INSERT INTO master_products(code,name,active,created_at,updated_at,origin_kind,inventory_eligible,search_text)
      VALUES(?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'local',1,?)`,
      [code, name, buildMasterSearchText('products', { code, name })],
    );
    const creation = await post(page, '/stocktakes', { warehouseCode: cell.warehouseCode, mode: 'blind' });
    expect(creation.status()).toBe(200);
    const take = (await creation.json()).data;
    takeId = take.id;
    await readCount(page, take.id, cell.productCode);
    await page.goto(`/stocktakes/${take.id}`);
    await page.getByRole('button', { name: '登记发现商品', exact: true }).click();
    let drawer = page.getByRole('dialog');
    await drawer.getByLabel('商品', { exact: true }).fill(code);
    await page.getByTitle(`${name} · ${code}`, { exact: true }).click();
    await drawer.getByLabel('实盘包数', { exact: true }).fill('3');
    await drawer.getByLabel('实盘吨数', { exact: true }).fill('0.8123');
    await drawer.getByLabel('发现原因', { exact: true }).fill('现场发现未登记货物');
    await screenshotWidths(page, 'b6e-2-discovery-create');
    await drawer.getByRole('button', { name: '保存发现行', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    let row = page.getByRole('row').filter({ hasText: code });
    await expect(row).toContainText('盘盈（新发现）');
    await expect(row).toContainText('3 / 0.8123');
    await expect(page.getByRole('columnheader', { name: /开始时库存|差异/ })).toHaveCount(0);
    await screenshotWidths(page, 'b6e-2-discovery-hidden');
    await row.getByRole('button', { name: '编辑发现商品', exact: true }).click();
    drawer = page.getByRole('dialog');
    await drawer.getByLabel('实盘包数', { exact: true }).fill('4');
    const detail = (await (await page.request.get(`/api/v1/stocktakes/${take.id}`)).json()).data;
    const line = detail.discoveries.items[0];
    const concurrent = await page.request.patch(`/api/v1/stocktake/${take.id}/discoveries/${line.id}`, {
      headers: { Origin: 'http://127.0.0.1:5174', 'Idempotency-Key': randomUUID() },
      data: { version: line.version, packages: 5, weightGrams: 812300, reason: '其他窗口重新核对' },
    });
    expect(concurrent.status()).toBe(200);
    await drawer.getByRole('button', { name: '保存发现行', exact: true }).click();
    await expect(drawer.getByRole('alert')).toContainText('该单据已被修改，请刷新后重试');
    await expect(drawer.getByLabel('实盘包数', { exact: true })).toHaveValue('4');
    await drawer.getByRole('button', { name: '刷新已保存值', exact: true }).click();
    await expect(drawer).toContainText('5 / 0.8123');
    await page.locator('.ant-notification-notice-close').click();
    await screenshotWidths(page, 'b6e-2-discovery-edit');
    await drawer.getByRole('button', { name: '保存发现行', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(row).toContainText('4 / 0.8123');
    await row.getByRole('button', { name: '删除发现行', exact: true }).click();
    await screenshotWidths(page, 'b6e-2-discovery-delete');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^取\s*消$/ })
      .click();
    await expect(row).toContainText('4 / 0.8123');
    await row.getByRole('button', { name: '删除发现行', exact: true }).click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole('button', { name: '登记发现商品', exact: true }).click();
    drawer = page.getByRole('dialog');
    await drawer.getByLabel('商品', { exact: true }).fill(code);
    await page.getByTitle(`${name} · ${code}`, { exact: true }).click();
    await drawer.getByLabel('实盘包数', { exact: true }).fill('3');
    await drawer.getByLabel('实盘吨数', { exact: true }).fill('0.8123');
    await drawer.getByLabel('发现原因', { exact: true }).fill('重新登记实物');
    await drawer.getByRole('button', { name: '保存发现行', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await page.getByRole('button', { name: '核对并揭示', exact: true }).click();
    await page.getByRole('button', { name: '确认揭示', exact: true }).click();
    row = page.getByRole('row').filter({ hasText: code });
    await expect(row).toContainText('0 / 0.0000');
    await page.getByRole('button', { name: '核对差异并回写', exact: true }).click();
    drawer = page.getByRole('dialog');
    await expect(drawer).toContainText('差异 2 行：2 包 / 0.5354 吨');
    await drawer.getByLabel('回写原因', { exact: true }).fill('发现行与原盘点差异一起回写');
    await screenshotWidths(page, 'b6e-2-discovery-preview');
    await drawer.getByRole('button', { name: '人工确认并回写库存', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('button', { name: '登记发现商品', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button')).toHaveCount(0);
    await expect(row).toContainText('已终结');
    await expect(page.getByTestId('object-audit-timeline')).toContainText('登记盘盈发现商品');
    await screenshotWidths(page, 'b6e-2-discovery-completed');
    expect(
      await db.get('SELECT packages,weight_tonnes FROM stock WHERE warehouse_code=? AND product_code=?', [
        cell.warehouseCode,
        code,
      ]),
    ).toEqual({ packages: 3, weight_tonnes: '0.8123' });
  } finally {
    if (takeId) {
      const take = await getStocktake(db, takeId);
      if (take.status === 'counting')
        await voidStocktake(db, {
          id: takeId,
          input: {
            expectedRevision: take.revision,
            reason: '发现行浏览器用例释放自身窗口',
          },
          key: randomUUID(),
          actor: { username: 'owner', traceId: 'discovery-e2e-cleanup' },
        });
    }
    await db.close();
  }
});
