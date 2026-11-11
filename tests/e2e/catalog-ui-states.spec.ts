import { test, expect, loginCatalog, uploadFile, publishFile } from './catalog-helpers';

test('catalog-candidate-recovery：刷新后从版本历史恢复候选并发布', async ({ page }) => {
  await loginCatalog(page);
  await uploadFile(page, '恢复规格 RESUME-A 301');
  await expect(page.getByText('第 2 版待发布', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '版本历史', exact: true }).click();
  await page.getByRole('button', { name: '继续核对第 2 版' }).click();
  await expect(page.getByRole('button', { name: '发布整版', exact: true })).toBeVisible();
  await publishFile(page);
  await expect(page.getByText('整版发布成功，已有事实未改变')).toBeVisible();
});

test('catalog-four-states：错误可重试、无权限可理解、零条版显示空态', async ({ page }) => {
  await loginCatalog(page);
  await page.route('**/api/v1/catalog', (route) =>
    route.fulfill({
      status: 500,
      json: { code: 'INTERNAL_ERROR', message: '目录状态暂时不可用', data: null, traceId: 'e2e-retry' },
    }),
  );
  await page.getByRole('button', { name: '刷新状态', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试目录状态' })).toBeVisible();
  await page.unroute('**/api/v1/catalog');
  await page.getByRole('button', { name: '重试目录状态' }).click();
  await expect(page.getByRole('button', { name: '重试目录状态' })).toBeHidden();
  await uploadFile(page, '');
  await publishFile(page);
  await expect(page.getByText('当前目录无有效条码；已有扫码记录仍可结束扫码并确认出库')).toBeVisible();
  await page.route('**/api/v1/catalog', (route) =>
    route.fulfill({
      status: 403,
      json: { code: 'CLIENT_NOT_ALLOWED', message: '无权限', data: null, traceId: 'e2e-denied' },
    }),
  );
  await page.getByRole('button', { name: '刷新状态', exact: true }).click();
  await expect(page.getByText('仅 Web 登录用户可管理条码目录')).toBeVisible();
});
