import { writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { startSortSample, readSortSample, p95, type SortSample } from './sort-feedback-helpers';

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
});

for (const kind of ['inbound', 'outbound'] as const) {
  const url = kind === 'inbound' ? '/inbound?keyword=WL-RK-' : '/?keyword=WL-CK-';
  const key = kind === 'inbound' ? 'receiptNo' : 'orderNo';
  test(`体验A ${kind} 排序翻页保留旧行/即时箭头/安全导出`, async ({ page }) => {
    await page.goto(url);
    const list = page.getByTestId(`${kind}-list`),
      shell = page.getByTestId(`${kind}-table-shell`);
    const rows = list.locator('tbody tr[data-row-key]');
    await expect(rows).toHaveCount(50);
    await expect(shell).toHaveAttribute('aria-busy', 'false');
    const original = await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-row-key')),
    );
    await list.getByRole('button', { name: '导出', exact: true }).click();
    let release = () => {};
    let arrived = false;
    await page.route(`**/api/v1/web/lists/${kind}?**`, async (route) => {
      const response = await route.fetch();
      await new Promise<void>((resolve) => {
        release = resolve;
        arrived = true;
      });
      await route.fulfill({ response });
    });
    const header = list.locator(`th[data-column-key="${key}"]`);
    await list.locator('.ant-table-body').evaluate((body) => {
      body.scrollTop = 300;
    });
    await startSortSample(page, key);
    await header.click();
    await expect.poll(() => arrived).toBe(true);
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await expect(shell).toHaveAttribute('aria-busy', 'true');
    await expect(list.getByRole('status', { name: '正在更新列表，暂显示上次结果' })).toBeVisible();
    await expect(page.locator('.ant-skeleton,.ant-spin-blur')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '生成 XLSX' })).toBeDisabled();
    expect(
      await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-row-key'))),
    ).toEqual(original);
    expect(await list.locator('.ant-table-body').evaluate((body) => body.scrollTop)).toBe(0);
    release();
    const delayed = await readSortSample(page);
    await expect(page.getByRole('button', { name: '生成 XLSX' })).toBeEnabled();
    await page
      .getByRole('dialog', { name: '导出当前列表' })
      .getByRole('button', { name: '关闭', exact: true })
      .click();
    const sorted = await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-row-key')),
    );
    expect(sorted).not.toEqual(original);
    arrived = false;
    await list.locator('li[title="2"]').click();
    await expect.poll(() => arrived).toBe(true);
    await expect(list.locator('li[title="2"]')).toHaveClass(/ant-pagination-item-active/);
    expect(
      await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-row-key'))),
    ).toEqual(sorted);
    await expect(page.locator('.ant-skeleton,.ant-spin-blur')).toHaveCount(0);
    release();
    await expect(shell).toHaveAttribute('aria-busy', 'false');
    expect(
      await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-row-key'))),
    ).not.toEqual(sorted);
    await page.unroute(`**/api/v1/web/lists/${kind}?**`);
    expect(delayed.minRows).toBe(50);
    await writeFile(`.local/evidence/list-ux-a/${kind}-sort-delayed.json`, JSON.stringify(delayed, null, 2));
    console.log('LIST_UX_A_SORT_DELAYED', JSON.stringify({ kind, ...delayed, pageRowsPreserved: true }));
  });

  test(`体验A ${kind} 排序30次p95`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(url);
    const list = page.getByTestId(`${kind}-list`),
      shell = page.getByTestId(`${kind}-table-shell`);
    await expect(list.locator('tbody tr[data-row-key]')).toHaveCount(50);
    await expect(shell).toHaveAttribute('aria-busy', 'false');
    const header = list.locator(`th[data-column-key="${key}"]`);
    const samples: SortSample[] = [];
    for (let index = 0; index < 30; index++) {
      await startSortSample(page, key);
      await header.click();
      const sample = await readSortSample(page);
      expect(sample.minRows).toBe(50);
      expect(sample.arrowMs).toBeGreaterThanOrEqual(0);
      expect(sample.requestMs).toBeGreaterThan(0);
      samples.push(sample);
    }
    const result = {
      kind,
      sampleCount: samples.length,
      viewport: 1440,
      pageSize: 50,
      p95: {
        arrowMs: p95(samples.map((s) => s.arrowMs)),
        requestMs: p95(samples.map((s) => s.requestMs)),
        renderedMs: p95(samples.map((s) => s.renderedMs)),
      },
      samples,
    };
    await writeFile(`.local/evidence/list-ux-a/${kind}-sort-p95.json`, JSON.stringify(result, null, 2));
    console.log('LIST_UX_A_SORT_P95', JSON.stringify({ kind, samples: samples.length, ...result.p95 }));
  });
}
