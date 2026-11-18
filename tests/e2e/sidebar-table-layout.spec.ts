import { mkdir } from 'node:fs/promises';
import { expect, type Locator } from '@playwright/test';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { e2eDatabase } from './inventory-helpers';
import { test } from './list-test';

test.beforeAll(async () => {
  const database = e2eDatabase();
  try {
    await seedListEvidence(database);
  } finally {
    await database.close();
  }
  await mkdir('.local/evidence/b7c-u01-u02', { recursive: true });
});

async function alignment(list: Locator, stock: boolean) {
  return list.evaluate((root, hasSummary) => {
    const row = root.querySelector<HTMLTableRowElement>('tbody tr[data-row-key]')!;
    const headers = [...root.querySelectorAll<HTMLTableCellElement>('thead th[data-column-key]')];
    return headers.map((head) => {
      const key = head.dataset.columnKey!;
      const bounds = head.getBoundingClientRect();
      const cells = [row.cells[head.cellIndex]!];
      if (hasSummary) cells.push(root.querySelector(`[data-summary-field="${key}"]`)!.closest('td')!);
      return Math.max(
        ...cells.flatMap((cell) => {
          const target = cell.getBoundingClientRect();
          return [Math.abs(target.left - bounds.left), Math.abs(target.right - bounds.right)];
        }),
      );
    });
  }, stock);
}

async function uncovered(target: Locator) {
  return target.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const rects: DOMRect[] = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      rects.push(...range.getClientRects());
    }
    return (
      rects.length > 0 &&
      rects.every((rect) =>
        [rect.left + 1, rect.right - 1].every((x) =>
          node.contains(document.elementFromPoint(x, rect.top + rect.height / 2)),
        ),
      )
    );
  });
}

for (const kind of ['inbound', 'stock'] as const) {
  test(`1280 侧栏展开后 ${kind} 的表头、数据及固定区域对齐`, async ({ page }) => {
    const stock = kind === 'stock';
    await page.setViewportSize({ width: 1280, height: 800 });
    await Promise.all([
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === `/api/v1/web/lists/${kind}` && response.ok(),
      ),
      page.goto(stock ? '/stock?product=WL-P000001' : '/inbound?keyword=WL-RK-000001'),
    ]);
    const list = page.getByTestId(`${kind}-list`);
    await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(1);
    await expect(page.locator('aside.ant-layout-sider')).toHaveCSS('width', '208px');
    const body = list.locator('.ant-table-body');
    for (const fraction of [0, 0.5, 1]) {
      await body.evaluate((el, part) => {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) * part;
      }, fraction);
      await expect.poll(async () => Math.max(...(await alignment(list, stock)))).toBeLessThan(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
    await body.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await list.locator('.ant-table-container').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    if (stock) {
      const pending = list.getByTestId('stock-pending');
      const available = list.getByTestId('stock-available');
      await list.evaluate((root) => {
        const body = root.querySelector<HTMLElement>('.ant-table-body')!;
        const column = (key: string) =>
          root.querySelector(`thead th[data-column-key="${key}"]`)!.getBoundingClientRect();
        body.scrollLeft +=
          (column('pending').left + column('available').right - column('productName').right - column('action').left) /
          2;
      });
      for (const target of [
        pending,
        available,
        ...['pending', 'available'].map((key) => list.locator(`[data-summary-field="${key}"]`)),
      ])
        await expect.poll(() => uncovered(target)).toBe(true);
    }
    await expect.poll(async () => Math.max(...(await alignment(list, stock)))).toBeLessThan(2);
    await page.screenshot({ path: `.local/evidence/b7c-u01-u02/after-${kind}-1280.png`, animations: 'disabled' });
  });
}
