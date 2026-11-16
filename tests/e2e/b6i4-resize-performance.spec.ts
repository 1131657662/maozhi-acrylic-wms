import { mkdir, writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { seedListEvidence } from '../../scripts/e2e-list-fixtures';
import { columnMetrics } from './column-helpers';
import {
  RESIZE_SAMPLE,
  dragResize,
  observeResizePerformance,
  readResizePerformance,
} from './resize-performance-helpers';

const evidenceRoot = '.local/evidence/b6i4';

test.beforeAll(async () => {
  const db = e2eDatabase();
  try {
    await seedListEvidence(db);
  } finally {
    await db.close();
  }
  await mkdir(evidenceRoot, { recursive: true });
});

for (const kind of ['inbound', 'outbound'] as const) {
  test(`B6i-4 ${kind} 连续十次拖拽松手/保存长任务与最终列宽`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.goto(kind === 'inbound' ? '/inbound?keyword=WL-RK-' : '/?keyword=WL-CK-');
    await expect(page.getByTestId(`${kind}-list`).locator('tbody tr[data-row-key]')).toHaveCount(50);
    await expect(page.getByTestId(`${kind}-table-shell`)).toHaveAttribute('aria-busy', 'false');
    const key = kind === 'inbound' ? 'receiptNo' : 'orderNo';
    const before = await columnMetrics(page, kind);
    let saves = 0;
    page.on('requestfinished', (request) => {
      if (request.method() === 'PUT' && request.url().includes(`/list-preferences/${kind}`)) saves++;
    });
    await observeResizePerformance(page);
    const widths = [];
    for (let index = 0; index < RESIZE_SAMPLE.count; index++) {
      const expected = await dragResize(page, key, index % 2 ? -RESIZE_SAMPLE.delta : RESIZE_SAMPLE.delta);
      const actual = await columnMetrics(page, kind);
      expect(actual.widths[key]).toBe(expected);
      expect(actual.alignment).toEqual(before.alignment);
      for (const name of Object.keys(before.widths))
        if (name !== key) expect(actual.widths[name]).toBe(before.widths[name]);
      widths.push(expected);
    }
    await expect.poll(() => saves).toBe(RESIZE_SAMPLE.count);
    const performance = await readResizePerformance(page);
    const result = { kind, widths, saves, ...performance };
    await writeFile(`${evidenceRoot}/${kind}-continuous-resize.json`, JSON.stringify(result, null, 2));
    console.log('B6I4_RESIZE', JSON.stringify(result));
    expect(performance.duration).toBeGreaterThanOrEqual(1000);
    expect(performance.tasks.filter((task) => task.duration > 50)).toEqual([]);
  });
}
