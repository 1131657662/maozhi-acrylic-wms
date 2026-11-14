import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Database } from '../../apps/api/src/db/mysql';
import { e2eDatabase, loginInventory, screenshotWidths } from './inventory-helpers';

test('库存 50/100/200 行 Peek 单次批量，抽屉与流水页复用结果并保留返回筛选', async ({ page }) => {
  test.setTimeout(120_000);
  const db = e2eDatabase();
  try {
    const prefix = await seedStockRows(db, 200);
    await loginInventory(page);
    const requests: { method: string; url: string; body: string | null }[] = [];
    page.on('request', (request) => {
      if (/\/stock\/peek|\/stock\/movements|\/web\/lists\/stock/.test(request.url()))
        requests.push({ method: request.method(), url: request.url(), body: request.postData() });
    });
    for (const pageSize of [50, 100, 200]) {
      const listsBefore = requests.filter((item) => item.url.includes('/web/lists/stock')).length;
      const peeksBefore = requests.filter((item) => item.url.includes('/stock/peek')).length;
      await page.goto(`/stock?scope=inventory&product=${prefix}&page=1&pageSize=${pageSize}`);
      await expect(stockRow(page, prefix, 0)).toBeVisible();
      expect(requests.filter((item) => item.url.includes('/web/lists/stock'))).toHaveLength(listsBefore + 1);
      expect(requests.filter((item) => item.url.includes('/stock/peek'))).toHaveLength(peeksBefore);
      const first = stockRow(page, prefix, 0);
      const peekResponse = page.waitForResponse((response) => response.url().includes('/stock/peek'));
      await first.getByRole('button', { name: '展开最近流水' }).click();
      const response = await peekResponse;
      expect(response.status()).toBe(200);
      expect(JSON.parse(response.request().postData()!).length).toBe(pageSize);
      await expect(page.getByTestId('stock-peek')).toBeVisible();
      await expect(page.getByTestId('stock-peek').locator('tbody tr[data-row-key]')).toHaveCount(3);
      const emptyRow = stockRow(page, prefix, 1);
      await emptyRow.getByRole('button', { name: '展开最近流水' }).click();
      await expect(page.getByText('该商品暂无流水', { exact: true })).toBeVisible();
      expect(requests.filter((item) => item.url.includes('/stock/peek'))).toHaveLength(peeksBefore + 1);
      await first.getByRole('button', { name: '展开最近流水' }).click();
      console.log(`B6F2C_HTTP rows=${pageSize} list=1 initial_peek=0 first_expand=1 second_expand=0`);
      if (pageSize === 100) {
        await screenshotWidths(page, 'b6f-2c-peek');
        const drawerResponse = page.waitForResponse((item) => item.url().includes('/stock/movements'));
        await page.getByRole('button', { name: '查看全部流水' }).click();
        const drawerResult = await drawerResponse;
        expect(drawerResult.status()).toBe(200);
        const first20 = (await drawerResult.json()).data.items;
        const movementRows = page.getByTestId('stock-movement-table').locator('tbody tr[data-row-key]');
        await expect(movementRows).toHaveCount(20);
        const drawerIds = await movementRows.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-row-key')));
        await screenshotWidths(page, 'b6f-2c-movement-drawer');
        await page.getByRole('button', { name: '关闭' }).click();
        await expect(page.getByTestId('stock-movement-table')).toBeHidden();
        expect(requests.filter((item) => item.url.includes('/stock/movements'))).toHaveLength(1);
        await page.getByRole('button', { name: '查看全部流水' }).click();
        await expect(movementRows).toHaveCount(20);
        expect(requests.filter((item) => item.url.includes('/stock/movements'))).toHaveLength(1);
        const pageResponse = page.waitForResponse((item) => item.url().includes('/stock/movements'));
        await page.getByRole('button', { name: '查看全部', exact: true }).click();
        await expect(page).toHaveURL(/\/stock\/journal\?warehouseCode=DEMO-WH&productCode=/);
        expect((await (await pageResponse).json()).data.items).toEqual(first20);
        await expect(movementRows).toHaveCount(20);
        expect(await movementRows.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-row-key')))).toEqual(
          drawerIds,
        );
        await expect(page.getByText('共 21 条')).toBeVisible();
        await screenshotWidths(page, 'b6f-2c-journal-page');
        const nextPage = page.waitForResponse(
          (item) => item.url().includes('/stock/movements') && item.url().includes('page=2'),
        );
        await page.locator('.ant-pagination-next button').click();
        expect((await nextPage).status()).toBe(200);
        await expect(movementRows).toHaveCount(1);
        await page.getByRole('textbox', { name: '商品编码' }).fill(`${prefix}-001`);
        await page.getByRole('button', { name: /^查\s*询$/ }).click();
        await expect(page).toHaveURL(/page=1/);
        await expect(page.getByText('该商品暂无流水', { exact: true })).toBeVisible();
        await expect(movementRows).toHaveCount(0);
        await page.getByRole('link', { name: '返回库存' }).click();
        await expect(page).toHaveURL(/\/stock\?.*product=.*pageSize=100/);
      }
    }
    expect(requests.filter((item) => item.url.includes('/stock/peek'))).toHaveLength(3);
  } finally {
    await db.close();
  }
});

test('翻页、筛选与刷新清空 Peek 缓存，失败可重试且不显示空态', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const prefix = await seedStockRows(db, 21);
    await loginInventory(page);
    let peeks = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/stock/peek')) peeks++;
    });
    await page.goto(`/stock?scope=inventory&product=${prefix}&pageSize=20`);
    await stockRow(page, prefix, 0).getByRole('button', { name: '展开最近流水' }).click();
    await expect(page.getByTestId('stock-peek').locator('tbody tr[data-row-key]')).toHaveCount(3);
    expect(peeks).toBe(1);
    await page.getByTestId('stock-list').locator('.ant-pagination-next button').click();
    await expect(stockRow(page, prefix, 20)).toBeVisible();
    await expect(page.getByTestId('stock-peek')).toHaveCount(0);
    expect(peeks).toBe(1);
    await stockRow(page, prefix, 20).getByRole('button', { name: '展开最近流水' }).click();
    await expect(page.getByTestId('stock-peek')).toContainText('该商品暂无流水');
    expect(peeks).toBe(2);
    await page.getByPlaceholder('商品名称或编码').fill(`${prefix}-000`);
    await page.getByRole('button', { name: /^查\s*询$/ }).click();
    await expect(stockRow(page, prefix, 0)).toBeVisible();
    await expect(page.getByTestId('stock-peek')).toHaveCount(0);
    expect(peeks).toBe(2);
    await page.route(
      '**/api/v1/stock/peek',
      (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'INTERNAL_ERROR', message: '流水查询暂不可用', data: null }),
        }),
      { times: 1 },
    );
    await stockRow(page, prefix, 0).getByRole('button', { name: '展开最近流水' }).click();
    await expect(page.getByTestId('stock-peek')).toContainText('系统出错了，已记录');
    await expect(page.getByTestId('stock-peek')).not.toContainText('该商品暂无流水');
    await page
      .getByTestId('stock-peek')
      .getByRole('button', { name: /^重\s*试$/ })
      .click();
    await expect(page.getByTestId('stock-peek').locator('tbody tr[data-row-key]')).toHaveCount(3);
    expect(peeks).toBe(4);
    const refreshed = page.waitForResponse((response) => response.url().includes('/web/lists/stock'));
    await page.getByTestId('stock-list').getByRole('img', { name: 'reload' }).click();
    await refreshed;
    await expect(page.getByTestId('stock-peek')).toBeHidden();
    expect(peeks).toBe(4);
    await stockRow(page, prefix, 0).getByRole('button', { name: '展开最近流水' }).click();
    await expect(page.getByTestId('stock-peek').locator('tbody tr[data-row-key]')).toHaveCount(3);
    expect(peeks).toBe(5);
  } finally {
    await db.close();
  }
});

function stockRow(page: import('@playwright/test').Page, prefix: string, index: number) {
  const code = `${prefix}-${index.toString().padStart(3, '0')}`;
  return page.getByTestId('stock-list').getByRole('row').filter({ hasText: code });
}

async function seedStockRows(db: Database, count: number) {
  const prefix = `B6C-${randomUUID().slice(0, 8)}`;
  for (let index = 0; index < count; index++) {
    const code = `${prefix}-${index.toString().padStart(3, '0')}`;
    await db.run(
      `INSERT INTO master_products(code,name,active,source_kind,created_at,updated_at,origin_kind,inventory_eligible)
      VALUES(?,?,1,'erp-product',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'legacy',1)`,
      [code, code],
    );
    await db.run(
      "INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES('DEMO-WH',?,10,'1.0000')",
      [code],
    );
    if (index === 0) await seedJournal(db, code);
  }
  return prefix;
}

async function seedJournal(db: Database, productCode: string) {
  for (let index = 0; index < 21; index++) {
    const id = randomUUID();
    await db.run(
      `INSERT INTO inventory_operations(id,operation_type,target_id,reason,actor,created_at)
      VALUES(?,'stock.adjust',?,'E2E 流水页筛选分页','owner',UTC_TIMESTAMP(3))`,
      [id, `DEMO-WH/${productCode}`],
    );
    await db.run(
      `INSERT INTO stock_journal(operation_id,warehouse_code,product_code,packages_delta,tonnes_delta,
      packages_before,packages_after,tonnes_before,tonnes_after,created_at,source_del_flag)
      VALUES(?,'DEMO-WH',?,0,'0.0000',10,10,'1.0000','1.0000',UTC_TIMESTAMP(3),0)`,
      [id, productCode],
    );
  }
}
