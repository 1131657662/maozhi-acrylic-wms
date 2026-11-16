import { expect, type Page } from '@playwright/test';
import { WEB_LIST_VIEW_SCHEMA_VERSION } from '@wms/contracts';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { columnMetrics, resetColumns, resizeColumn } from './column-helpers';

async function cancelResize(page: Page, key: string) {
  const handle = page.getByTestId(`resize-${key}`);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 10 });
  await handle.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
}

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
});

for (const kind of ['inbound', 'outbound'] as const) {
  test(`B6i-4 ${kind} 已提交宽度在取消/键盘/视图/布局接管后保持一致`, async ({ page }) => {
    const key = kind === 'inbound' ? 'receiptNo' : 'orderNo';
    await page.goto(kind === 'inbound' ? '/inbound?keyword=WL-RK-' : '/?keyword=WL-CK-');
    const list = page.getByTestId(`${kind}-list`);
    await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
    await resizeColumn(page, key, 100);
    await cancelResize(page, key);
    expect((await columnMetrics(page, kind)).widths[key]).toBe(320);
    await page.getByTestId(`resize-${key}`).press('ArrowRight');
    expect((await columnMetrics(page, kind)).widths[key]).toBe(330);
    await page.getByRole('textbox', { name: '视图名称' }).fill('拖宽后视图');
    await page.getByRole('button', { name: '保存视图' }).click();
    const viewKey = `b6b-list-views:owner:${kind}:v${WEB_LIST_VIEW_SCHEMA_VERSION}`;
    expect(
      await page.evaluate(({ viewKey, key }) => JSON.parse(localStorage.getItem(viewKey)!)[0].columns[key].width, {
        viewKey,
        key,
      }),
    ).toBe(330);
    await resetColumns(page, kind, true);
    expect((await columnMetrics(page, kind)).widths[key]).toBe(220);
    await page
      .getByRole('combobox', { name: '已保存视图' })
      .locator('..')
      .locator('..')
      .getByRole('button', { name: '清除' })
      .click();
    await page.getByRole('combobox', { name: '已保存视图' }).click();
    await page.getByTitle('拖宽后视图').last().click();
    await expect.poll(async () => (await columnMetrics(page, kind)).widths[key]).toBe(330);
    await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
    expect((await columnMetrics(page, kind)).widths[key]).toBe(330);
    await page.getByTestId(`resize-${key}`).press('Home');
    await expect.poll(async () => (await columnMetrics(page, kind)).widths[key]).toBe(220);
    await resizeColumn(page, 'status', -100);
    expect((await columnMetrics(page, kind)).widths.status).toBe(90);
    await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').uncheck();
    expect((await columnMetrics(page, kind)).widths.status).toBe(90);
  });
}
