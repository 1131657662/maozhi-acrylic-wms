import { mkdir, writeFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';

const root = '.local/evidence/b6b-step5';
test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
  await mkdir(root, { recursive: true });
});

async function capture(page: Page, name: string) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await page.screenshot({ path: `${root}/${name}.png`, fullPage: true, animations: 'disabled' });
  return { name, ...dimensions };
}

async function tableRect(page: Page, kind: string) {
  return page
    .getByTestId(kind + '-list')
    .locator('.ant-table-container')
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
}

async function verifyDrawer(page: Page, kind: string, width: number) {
  const trigger = page.getByRole('button', { name: /^筛选（/ });
  const before = await tableRect(page, kind);
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: '高级筛选' });
  await expect(drawer).toBeVisible();
  const shot = await capture(page, `${kind}-query-${width}`);
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await tableRect(page, kind)).toEqual(before);
  await trigger.click();
  await drawer.getByRole('textbox', { name: '商品编码', exact: true }).fill('WL-P000130');
  await drawer.getByRole('button', { name: /查\s*询/ }).click();
  await expect(page).toHaveURL(/productCodes=WL-P000130/);
  await expect(page.getByTestId(kind + '-list').locator('tbody tr[data-row-key]')).toHaveCount(1);
  await expect(page.getByText('商品编码：WL-P000130', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('商品编码：WL-P000130', { exact: true })).toBeVisible();
  return shot;
}

for (const kind of ['inbound', 'outbound'])
  for (const width of [1440, 1280]) {
    test(`B6b Step 5 ${kind} ${width} 列表/批量栏/查询抽屉/导出面板`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      const url =
        (kind === 'inbound' ? '/inbound' : '/') + `?keyword=WL-${kind === 'inbound' ? 'RK' : 'CK'}-&pageSize=50`;
      await page.goto(url);
      const list = page.getByTestId(kind + '-list');
      await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
      const shots = [await capture(page, `${kind}-list-${width}`)];
      const before = await tableRect(page, kind);
      await list.locator('tbody tr[data-row-key]').first().getByRole('checkbox').check();
      await expect(page.getByTestId(kind + '-batch-actions')).toBeVisible();
      const after = await tableRect(page, kind);
      const selectionDelta = {
        x: after.x - before.x,
        y: after.y - before.y,
        width: after.width - before.width,
        height: after.height - before.height,
      };
      expect(selectionDelta).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      shots.push(await capture(page, `${kind}-batch-${width}`));
      await page
        .getByTestId(kind + '-batch-actions')
        .getByRole('button', { name: '清空选择' })
        .click();
      expect(await tableRect(page, kind)).toEqual(before);
      shots.push(await verifyDrawer(page, kind, width));
      await list.getByRole('button', { name: '导出', exact: true }).click();
      await page.getByRole('radio', { name: '命中明细 · 2 行' }).check();
      shots.push(await capture(page, `${kind}-export-${width}`));
      await writeFile(
        `${root}/${kind}-${width}-layout.json`,
        JSON.stringify({ shots, before, after, selectionDelta }, null, 2),
      );
      console.log('B6B_STEP5_LAYOUT ' + JSON.stringify({ kind, width, shots, selectionDelta }));
    });
  }
