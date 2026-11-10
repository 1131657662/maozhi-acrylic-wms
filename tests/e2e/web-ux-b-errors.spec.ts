import { expect } from '@playwright/test';
import { test } from './list-test';
import { fillReceipt, expectRetained } from './web-ux-b-helpers';

test('B 错误：服务不可用可重试，诊断默认折叠', async ({ page }) => {
  await page.route('**/api/v1/web/lists/inbound?**', (route) =>
    route.fulfill({ status: 502, body: 'ECONNREFUSED SQL stack' }),
  );
  await page.goto('/inbound');
  await expect(page.getByText('服务暂时不可用，请稍后重试', { exact: true })).toBeVisible();
  await expect(page.getByText('502', { exact: true })).not.toBeVisible();
  await expect(page.getByText(/ECONNREFUSED|SQL|stack/)).toHaveCount(0);
  await page.screenshot({ path: '.local/evidence/web-ux-b/error-1440.png', fullPage: true });
  await page.unroute('**/api/v1/web/lists/inbound?**');
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByTestId('list-results')).toBeVisible();
});
test('B 错误：断网提交保留输入，同类提示不刷屏', async ({ page, context }) => {
  await fillReceipt(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  await expect(page.getByText('网络连接中断，请检查网络后重试', { exact: true }).first()).toBeVisible();
  await expectRetained(page);
  const retry = page.getByRole('button', { name: /创建待确认入库单$/ });
  await expect(retry).toBeEnabled();
  await expect(retry).not.toHaveClass(/ant-btn-loading/);
  await retry.click();
  await expect(page.locator('.ant-notification-notice')).toHaveCount(1);
  await context.setOffline(false);
});
test('B 错误：422 定位商品重量并高亮', async ({ page }) => {
  await fillReceipt(page);
  await page.route('**/api/v1/inbound', (route) =>
    route.fulfill({
      status: 422,
      json: {
        code: 'VALIDATION_ERROR',
        message: '填写有误，请检查标红的内容',
        traceId: 'b-validation',
        data: { fields: [{ path: ['lines', 0, 'weightGrams'], message: '重量必须大于零' }] },
      },
    }),
  );
  await page.getByRole('button', { name: '创建待确认入库单', exact: true }).click();
  await expect(page.locator('.ant-form-item-has-error').filter({ hasText: '本次总重量' })).toContainText(
    '重量必须大于零',
  );
  await expectRetained(page);
});
test('B 错误：409 显示刷新动作且不暴露服务异常', async ({ page }) => {
  await page.route('**/api/v1/web/lists/inbound?**', (route) =>
    route.fulfill({
      status: 409,
      json: { code: 'STALE', message: 'SQL stack conflict', traceId: 'b-conflict', data: null },
    }),
  );
  await page.goto('/inbound');
  await expect(page.getByText('该单据已被修改，请刷新后重试', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /刷\s*新/ })).toBeVisible();
  await expect(page.getByText(/SQL|stack|b-conflict/)).toHaveCount(0);
  await page.unroute('**/api/v1/web/lists/inbound?**');
  await page.getByRole('button', { name: /刷\s*新/ }).click();
  await expect(page.getByTestId('list-results')).toBeVisible();
});
