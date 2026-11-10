import { mkdir, writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { columnMetrics, resizeColumn, toggleColumn, resetColumns } from './column-helpers';

const root = '.local/evidence/b6b-followup';
test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
  await mkdir(root, { recursive: true });
});

for (const kind of ['inbound', 'outbound'])
  for (const width of [1440, 1280]) {
    test(`B6b ${kind} ${width} 列宽独立/隐藏列/重排/刷新/重置`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width, height: 960 });
      await page.goto(kind === 'inbound' ? '/inbound?keyword=WL-RK-' : '/?keyword=WL-CK-');
      const list = page.getByTestId(`${kind}-list`);
      await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
      const defaults = await columnMetrics(page, kind);
      const numberKey = kind === 'inbound' ? 'receiptNo' : 'orderNo';
      const packagesKey = kind === 'inbound' ? 'packages' : 'plannedPackages';
      expect(defaults.widths[numberKey]).toBe(220);
      expect(defaults.widths[packagesKey]).toBe(100);
      expect(defaults.widths.status).toBe(240);
      expect(defaults.widths.action).toBe(180);
      await resizeColumn(page, packagesKey, 20);
      await expect
        .poll(async () => (await columnMetrics(page, kind)).widths[packagesKey])
        .toBe(defaults.widths[packagesKey]! + 20);
      const before = await columnMetrics(page, kind);
      await resizeColumn(page, numberKey, 100);
      await expect
        .poll(async () => (await columnMetrics(page, kind)).widths[numberKey])
        .toBe(before.widths[numberKey]! + 100);
      const resized = await columnMetrics(page, kind);
      expect(resized.alignment).toEqual(Object.fromEntries(Object.keys(resized.alignment).map((key) => [key, 0])));
      for (const key of Object.keys(before.widths))
        if (key !== numberKey) expect(resized.widths[key]).toBe(before.widths[key]);
      expect(resized.scrollWidth - before.scrollWidth).toBe(100);
      expect(resized.clientWidth).toBe(before.clientWidth);
      expect(resized.scrollLeft).toBe(before.scrollLeft);
      expect(resized.pageScrollWidth).toBe(width);
      await page.screenshot({ path: `${root}/${kind}-resized-${width}.png`, fullPage: true });

      await toggleColumn(page, kind, '商品型号');
      const shown = await columnMetrics(page, kind);
      expect(shown.widths.productModels).toBe(120);
      expect(shown.scrollWidth - resized.scrollWidth).toBe(120);
      for (const key of Object.keys(resized.widths)) expect(shown.widths[key]).toBe(resized.widths[key]);
      await list.locator('.ant-table-body').evaluate((body) => {
        body.scrollLeft = body.scrollWidth;
      });
      await page.screenshot({ path: `${root}/${kind}-hidden-shown-${width}.png`, fullPage: true });
      await list.locator('.ant-table-body').evaluate((body) => {
        body.scrollLeft = 0;
      });
      await page.getByTestId('resize-productModels').press('ArrowRight');
      expect((await columnMetrics(page, kind)).widths.productModels).toBe(130);
      await toggleColumn(page, kind, '商品型号');
      expect((await columnMetrics(page, kind)).scrollWidth).toBe(resized.scrollWidth);

      await list.getByRole('img', { name: 'setting', exact: true }).click();
      await page.locator('.ant-tree-list-holder').evaluateAll((elements) =>
        elements.forEach((element) => {
          element.scrollTop = 0;
        }),
      );
      const source = page
        .getByRole('treeitem')
        .filter({ hasText: kind === 'inbound' ? /^总重量（吨）$/ : /^实扫重量（吨）$/ })
        .locator('.ant-tree-node-content-wrapper');
      const target = page
        .getByRole('treeitem')
        .filter({ hasText: kind === 'inbound' ? /^供应商$/ : /^仓库$/ })
        .locator('.ant-tree-node-content-wrapper');
      const dragSource = source;
      await dragSource.hover();
      const start = (await dragSource.boundingBox())!;
      const end = (await target.boundingBox())!;
      await page.mouse.move(start.x + 40, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + 50, start.y + start.height / 2, { steps: 5 });
      await page.mouse.move(end.x + 40, end.y + end.height - 2, { steps: 12 });
      await page.mouse.move(end.x + 41, end.y + end.height - 2);
      await expect(page.locator('.ant-tree-drop-indicator')).toBeVisible();
      await page.mouse.up();
      await page.getByRole('heading', { name: kind === 'inbound' ? '入库记录' : '出库工作台', exact: true }).click();
      await expect.poll(async () => (await columnMetrics(page, kind)).order).not.toEqual(resized.order);
      const reordered = await columnMetrics(page, kind);
      expect(reordered.widths).toEqual(resized.widths);
      await page.reload();
      await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
      expect((await columnMetrics(page, kind)).widths).toEqual(reordered.widths);
      expect((await columnMetrics(page, kind)).order).toEqual(reordered.order);
      await toggleColumn(page, kind, '商品型号');
      expect((await columnMetrics(page, kind)).widths.productModels).toBe(130);
      await toggleColumn(page, kind, '商品型号');

      const unselected = await columnMetrics(page, kind);
      await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
      const selected = await columnMetrics(page, kind);
      expect(selected.rect).toEqual(unselected.rect);
      expect(selected.pageScrollWidth).toBe(width);
      await page.screenshot({ path: `${root}/${kind}-batch-${width}.png`, fullPage: true });
      await list.getByRole('button', { name: '导出', exact: true }).click();
      await expect(page.getByRole('radio', { name: '选中记录 · 1 单' })).toBeVisible();
      await page.screenshot({ path: `${root}/${kind}-export-${width}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      await resetColumns(page, kind, true);
      expect((await columnMetrics(page, kind)).widths).toEqual(defaults.widths);
      await toggleColumn(page, kind, '商品型号');
      expect((await columnMetrics(page, kind)).widths.productModels).toBe(120);
      await resetColumns(page, kind);
      expect((await columnMetrics(page, kind)).widths).toEqual(defaults.widths);
      expect((await columnMetrics(page, kind)).order).toEqual(defaults.order);
      await resizeColumn(page, numberKey, 100);
      await page.getByTestId(`resize-${numberKey}`).dblclick();
      expect((await columnMetrics(page, kind)).widths[numberKey]).toBe(defaults.widths[numberKey]);
      await list.getByRole('img', { name: 'setting', exact: true }).click();
      await page.getByRole('checkbox', { name: '列展示', exact: true }).check();
      await page.getByRole('checkbox', { name: '列展示', exact: true }).uncheck();
      await page.getByRole('heading', { name: kind === 'inbound' ? '入库记录' : '出库工作台', exact: true }).click();
      await expect(list.getByRole('separator')).toHaveCount(0);
      const narrow = await list
        .locator('.ant-table-body')
        .evaluate((body) => ({ scroll: body.scrollWidth, client: body.clientWidth }));
      expect(narrow.scroll).toBe(narrow.client);
      await resetColumns(page, kind);
      const evidence = { kind, width, defaults, before, resized, shown, reordered, selected, displacementPx: 0 };
      await writeFile(`${root}/${kind}-${width}-columns.json`, JSON.stringify(evidence, null, 2));
      console.log(
        'B6B_COLUMNS ' +
          JSON.stringify({
            kind,
            width,
            numberBefore: before.widths[numberKey],
            numberAfter: resized.widths[numberKey],
            totalBefore: before.scrollWidth,
            totalAfter: resized.scrollWidth,
            clientWidth: resized.clientWidth,
            hiddenWidth: shown.widths.productModels,
            displacementPx: 0,
          }),
      );
    });
  }
