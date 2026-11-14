import { expect } from '@playwright/test';
import { test } from './list-test';

for (const [kind, path] of [
  ['inbound', '/inbound'],
  ['outbound', '/'],
  ['stock', '/stock'],
  ['audit', '/audit'],
]) {
  test('B1b1 ' + kind + ' 加载/空态/错误重试/无权限不残留数据', async ({ page }) => {
    let mode = 'loading';
    let release: () => void = () => undefined;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/web/lists/' + kind + '?**', async (route) => {
      if (mode === 'loading') await waiting;
      if (mode === 'success') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: mode === 'forbidden' ? 403 : mode === 'error' ? 500 : 200,
        json: {
          code: 'TEST',
          message: '列表验收响应',
          traceId: 'b1b-states',
          data:
            mode === 'empty'
              ? {
                  items: [],
                  total: 0,
                  page: 1,
                  pageSize: 20,
                  viewToken: 'empty',
                  ...(kind === 'stock'
                    ? {
                        source: 'inventory',
                        subtotal: { packages: 0, weightGrams: 0 },
                        asOf: '2026-11-14T00:00:00.000Z',
                        watermark: '0'.repeat(64),
                      }
                    : {}),
                }
              : null,
        },
      });
    });
    await page.goto(path!);
    await expect(page.getByRole('status', { name: '正在查询列表', exact: true })).toBeVisible();
    await expect(page.locator('.ant-skeleton')).toHaveCount(kind === 'audit' ? 1 : 0);
    mode = 'error';
    release();
    await expect(page.getByText('系统出错了，已记录')).toBeVisible();
    await expect(page.getByTestId('list-results')).toHaveCount(0);
    mode = 'success';
    await page.getByRole('button', { name: /重\s*试/ }).click();
    await expect(page.getByTestId('list-results')).toBeVisible();
    mode = 'empty';
    await page.reload();
    await expect(
      page.getByText(kind === 'audit' ? '该时间范围内没有操作记录' : '没有符合条件的记录，可调整筛选条件或重置后重试'),
    ).toBeVisible();
    mode = 'forbidden';
    await page.reload();
    await expect(page.getByText('没有权限执行此操作')).toBeVisible();
    await expect(page.getByTestId('list-results')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    console.log('B1B1_STATES ' + kind + ' loading/empty/retry/403=verified stale_rows=0');
  });
}
