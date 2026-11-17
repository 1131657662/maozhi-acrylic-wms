import { expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { test } from './list-test';
import { e2eDatabase, screenshotWidths } from './inventory-helpers';
import { artifactFixture } from '../../apps/api/tests/maintenance-fixture';
import { localMaintenanceOptions } from '../../apps/api/src/features/maintenance/options';
import { adminConfig } from '../../scripts/mysql/local-config';
import { insertBackup } from '../../apps/api/src/features/maintenance/jobs';
import { maintenanceActor } from '../../apps/api/tests/maintenance-fixture';
import { randomUUID } from 'node:crypto';

test('B8a-1 点击真实备份、防连点、校验下载与双宽页面', async ({ page }) => {
  let creates = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/maintenance/backups')) creates++;
  });
  await page.goto('/maintenance');
  await expect(page.getByRole('heading', { name: '系统维护' })).toBeVisible();
  const button = page.getByRole('button', { name: '立即备份', exact: true });
  await expect(button).toBeEnabled();
  const accepted = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/maintenance/backups'),
  );
  await button.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect((await accepted).status()).toBe(202);
  await expect(page.getByTestId('maintenance-jobs').getByText('已完成', { exact: true }).first()).toBeVisible();
  await expect(button).toBeEnabled();
  expect(creates).toBe(1);
  const artifacts = page.getByTestId('maintenance-artifacts');
  await expect(artifacts.getByRole('button', { name: '下载', exact: true }).first()).toBeVisible();
  const rows = await (await page.request.get('/api/v1/maintenance/artifacts')).json();
  const file = rows.data.items[0];
  await expect(artifacts.getByText(file.sha256, { exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await artifacts.getByRole('button', { name: '下载', exact: true }).first().click();
  const downloaded = await downloading,
    bytes = await readFile((await downloaded.path())!);
  expect(bytes.length).toBe(file.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
  expect(bytes.toString()).toContain('CREATE TABLE `stock`');
  await screenshotWidths(page, 'b8a1/backup');
  await page.getByRole('tab', { name: '健康', exact: true }).click();
  await expect(page.getByTestId('maintenance-health-database')).toContainText('正常');
  await expect(page.getByTestId('maintenance-health-http')).toContainText('不支持');
  await screenshotWidths(page, 'b8a1/health');
});

test('B8a-1 篡改真实文件后下载被拒绝，页面显示原因', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
    const options = localMaintenanceOptions({ ...adminConfig(), database: name });
    const file = await artifactFixture(db, {
      root: options.directory,
      at: new Date().toISOString(),
      content: 'before',
    });
    await writeFile(path.join(options.directory, `${file.id}.sql`), 'broken');
    await page.goto('/maintenance');
    const row = page.getByTestId('maintenance-artifacts').getByRole('row').filter({ hasText: file.sha256 });
    const response = page.waitForResponse((r) => r.url().endsWith(`/artifacts/${file.id}/download`));
    let downloads = 0;
    page.on('download', () => downloads++);
    await row.getByRole('button', { name: '下载', exact: true }).click();
    expect((await response).status()).toBe(409);
    await expect(page.getByText('备份文件缺失或检查不通过，已拒绝下载', { exact: true })).toBeVisible();
    expect(downloads).toBe(0);
    await expect(page.getByText(file.id, { exact: true })).toHaveCount(0);
  } finally {
    await db.close();
  }
});

test('B8a-1 健康刷新断连撤下旧正常值，重试恢复真实状态', async ({ page }) => {
  await page.goto('/maintenance');
  await page.getByRole('tab', { name: '健康', exact: true }).click();
  await expect(page.getByTestId('maintenance-health-database')).toContainText('正常');
  await page.route('**/api/v1/maintenance/health', (route) =>
    route.fulfill({
      status: 503,
      json: {
        code: 'MAINTENANCE_DATABASE_UNAVAILABLE',
        message: '数据库连接异常，暂时无法校验登录状态',
        data: null,
        traceId: 'test-outage',
      },
    }),
  );
  await page.getByRole('button', { name: /刷\s*新/ }).click();
  await expect(page.getByText('数据库连接异常，无法校验当前健康状态', { exact: true })).toBeVisible();
  await expect(page.getByText('正常', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('maintenance-health-database')).toHaveCount(0);
  await page.screenshot({ path: '.local/evidence/b8a1/health-outage-1440.png', fullPage: true });
  await page.unroute('**/api/v1/maintenance/health');
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByTestId('maintenance-health-database')).toContainText('正常');
});

test('B8a-1 创建响应丢失后重试使用原请求键且不重复创建', async ({ page }) => {
  const db = e2eDatabase(),
    keys: string[] = [];
  try {
    const before = Number((await db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n);
    await page.route('**/api/v1/maintenance/backups', async (route) => {
      keys.push(route.request().headers()['idempotency-key']!);
      if (keys.length === 1) {
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    });
    await page.goto('/maintenance');
    await page.getByRole('button', { name: '立即备份', exact: true }).click();
    const retry = page.getByRole('button', { name: '重试备份请求', exact: true });
    await expect(retry).toBeEnabled();
    await retry.click();
    await expect(page.getByRole('button', { name: '立即备份', exact: true })).toBeEnabled();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    expect(Number((await db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n)).toBe(before + 1);
  } finally {
    await db.close();
  }
});

test('B8a-1 清理需要二次确认且保留当前全部文件', async ({ page }) => {
  await page.goto('/maintenance');
  const before = (await (await page.request.get('/api/v1/maintenance/artifacts')).json()).data.total;
  await page.getByRole('button', { name: '清理过期备份', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('最近30天的文件均保留');
  await modal.getByRole('button', { name: /取\s*消/ }).click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: '清理过期备份', exact: true }).click();
  await modal.getByRole('button', { name: '清理过期备份', exact: true }).click();
  await expect(page.getByText(`已清理 0 份，按策略保留 ${before} 份`, { exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/v1/maintenance/artifacts')).json()).data.total).toBe(before);
});

test('B8a-1 健康页展示备份失败时间与原因，自动调度失败标异常', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const jobId = await insertBackup(db, maintenanceActor, randomUUID());
    const reason = '合成验收：备份磁盘空间不足';
    await db.run("UPDATE maintenance_jobs SET status='failed',finished_at=UTC_TIMESTAMP(3),error=? WHERE id=?", [
      reason,
      jobId,
    ]);
    await db.run("INSERT INTO scheduler_runs VALUES(?,'backup',UTC_TIMESTAMP(3),'failed',?)", [
      randomUUID(),
      JSON.stringify({ reason, jobId }),
    ]);
    await page.goto('/maintenance');
    await page.getByRole('tab', { name: '健康', exact: true }).click();
    const card = page.getByTestId('maintenance-health-backup');
    await expect(card).toContainText('异常');
    await expect(card).toContainText('最近自动调度：失败');
    await expect(card).toContainText(`失败原因：${reason}`);
    await expect(card).toContainText(/最近失败时间：\d{4}-\d{2}-\d{2}/);
    await expect(card).not.toContainText(jobId);
    await page.screenshot({ path: '.local/evidence/b8a1/health-backup-failed-1440.png', fullPage: true });
  } finally {
    await db.close();
  }
});
