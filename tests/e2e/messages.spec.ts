import { expect } from '@playwright/test';
import { test } from './list-test';
import { browserMessageSources } from './messages-fixture';
import { e2eDatabase, screenshotWidths } from './inventory-helpers';
import { notificationFixture } from '../../apps/api/tests/messages-fixture';
import { errorCopy } from '../../apps/web/src/text';

test('B8c六类真实扫描、逐条跳转已读、共享角标即时减少与双宽截图', async ({ page }) => {
  test.setTimeout(120000);
  const c = await browserMessageSources();
  try {
    expect(new Set(c.messages.map((row) => row.type)).size).toBe(6);
    for (const [index, row] of c.messages.entries()) {
      await page.goto('/messages');
      await expect(page.getByRole('heading', { name: '消息中心', exact: true })).toBeVisible();
      await page.getByRole('combobox', { name: '阅读状态' }).click();
      await page.locator('.ant-select-dropdown:visible').getByText('仅未读', { exact: true }).click();
      await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(c.messages.length - index);
      if (index === 0) await screenshotWidths(page, 'b8c/messages');
      const before = (await (await page.request.get('/api/v1/messages/unread-count')).json()).data.unreadCount;
      await page.locator(`tr[data-row-key="${row.id}"]`).getByRole('link').click();
      await expect(page).toHaveURL(new RegExp(`${String(row.link_path)}$`));
      await expect(page.getByTestId('message-unread-badge')).toHaveAttribute('aria-label', `未读 ${before - 1} 条`);
      expect((await c.db.get('SELECT read_at FROM notifications WHERE id=?', [String(row.id)]))?.read_at).toBeTruthy();
      await expect(page.getByRole('main')).not.toContainText('对象不存在');
    }
    await page.goto('/maintenance');
    await page.getByRole('tab', { name: '健康', exact: true }).click();
    await expect(page.getByTestId('maintenance-health-messages')).toContainText('成功');
    await screenshotWidths(page, 'b8c/scan-health');
  } finally {
    await c.db.close();
  }
});

test('B8c类型/未读筛选、真实分页和全部已读', async ({ page }) => {
  const db = e2eDatabase();
  try {
    for (let i = 0; i < 51; i++)
      await notificationFixture(db, { type: 'backup_failed', createdAt: '2099-01-01 00:00:00' });
    await page.goto('/messages');
    await page.getByRole('combobox', { name: '消息类型' }).click();
    await page.locator('.ant-select-dropdown:visible').getByText('备份失败', { exact: true }).click();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
    await page.locator('.ant-pagination-item-2').click();
    await expect(page.getByRole('table').locator('tbody tr')).not.toHaveCount(50);
    await page.getByRole('combobox', { name: '阅读状态' }).click();
    await page.locator('.ant-select-dropdown:visible').getByText('仅未读', { exact: true }).click();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);
    await page.getByRole('button', { name: '全部已读', exact: true }).click();
    await expect(page.getByTestId('message-unread-badge')).toHaveAttribute('aria-label', '未读 0 条');
    await expect(page.getByText('暂无消息', { exact: true })).toBeVisible();
  } finally {
    await db.close();
  }
});

test('B8c加载、列表错误与未知角标分开，重试恢复', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/messages?*', async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto('/messages');
  await expect(page.getByTestId('messages-loading')).toBeVisible();
  release();
  await expect(page.getByTestId('messages-loading')).toHaveCount(0);
  await page.unroute('**/api/v1/messages?*');
  const failure = { status: 503, json: { code: 'TEST_UNAVAILABLE', message: '合成读取失败', data: null } };
  await page.route('**/api/v1/messages?*', (route) => route.fulfill(failure));
  await page.route('**/api/v1/messages/unread-count', (route) => route.fulfill(failure));
  await page.reload();
  await expect(page.getByText('消息读取失败，请重试', { exact: true })).toBeVisible();
  await expect(page.getByTestId('message-unread-badge')).toHaveCount(0);
  await expect(page.getByText('暂无消息', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/v1/messages?*');
  await page.unroute('**/api/v1/messages/unread-count');
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByRole('table')).toBeVisible();
});

test('B8c侧栏60秒轮询刷新，已读失败保留当前位置和未读', async ({ page }) => {
  await page.clock.install();
  await page.goto('/messages');
  const db = e2eDatabase();
  try {
    await expect(page.getByTestId('message-unread-badge')).toHaveAttribute('aria-label', /未读 \d+ 条/);
    const before = (await (await page.request.get('/api/v1/messages/unread-count')).json()).data.unreadCount;
    const id = await notificationFixture(db, { createdAt: '2099-01-02 00:00:00' });
    await page.clock.runFor(60001);
    await expect(page.getByTestId('message-unread-badge')).toHaveAttribute('aria-label', `未读 ${before + 1} 条`);
    await page.reload();
    await page.route(`**/api/v1/messages/${id}/read`, (route) =>
      route.fulfill({ status: 503, json: { code: 'TEST_WRITE_FAILED', message: '合成已读失败', data: null } }),
    );
    await page.getByRole('link', { name: '待确认出库单', exact: true }).first().click();
    await expect(page.getByRole('alert').filter({ hasText: errorCopy.UNAVAILABLE[0] }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/messages$/);
    expect((await db.get('SELECT read_at FROM notifications WHERE id=?', [id]))?.read_at).toBeNull();
  } finally {
    await db.close();
  }
});
