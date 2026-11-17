import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { test } from './list-test';
import { e2eDatabase, screenshotWidths } from './inventory-helpers';
import { artifactFixture } from '../../apps/api/tests/maintenance-fixture';
import { localMaintenanceOptions } from '../../apps/api/src/features/maintenance/options';
import { adminConfig } from '../../scripts/mysql/local-config';

test('B8a-2 确认词、防连点、真实阶段与核验报告双宽验收', async ({ page }) => {
  await page.goto('/maintenance');
  const backup = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith('/maintenance/backups'),
  );
  await page.getByRole('button', { name: '立即备份', exact: true }).click();
  const backupId = (await (await backup).json()).data.jobId;
  const backupButton = page.getByRole('button', { name: '立即备份', exact: true });
  await expect(backupButton).toBeEnabled();
  const artifacts = (await (await page.request.get('/api/v1/maintenance/artifacts')).json()).data.items;
  const artifact = artifacts.find((row: { id: string }) => row.id === backupId);
  const row = page.getByTestId('maintenance-artifacts').getByRole('row').filter({ hasText: artifact.sha256 });
  await row.getByRole('button', { name: '恢复', exact: true }).click();
  const modal = page.getByRole('dialog'),
    submit = modal.getByRole('button', { name: '开始隔离恢复', exact: true });
  await modal.getByLabel('输入 RECOVER 确认').fill('recover');
  await expect(submit).toBeDisabled();
  await modal.getByLabel('输入 RECOVER 确认').fill('RECOVER');
  await screenshotWidths(page, 'b8a2/restore-confirm');
  let requests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/maintenance/restores')) requests++;
  });
  const accepted = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith('/maintenance/restores'),
  );
  await submit.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const response = await accepted;
  expect(response.status()).toBe(202);
  const jobId = (await response.json()).data.jobId;
  await expect(page.getByTestId('restore-report').getByText('核验通过', { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await (await page.request.get(`/api/v1/maintenance/restores/${jobId}`)).json()).data.job.status)
    .toBe('succeeded');
  expect(requests).toBe(1);
  const detail = (await (await page.request.get(`/api/v1/maintenance/restores/${jobId}`)).json()).data;
  expect([...new Set(detail.evidence.map((entry: { stage: string }) => entry.stage))]).toEqual([
    'backup',
    'provision',
    'import',
    'verify',
    'report',
  ]);
  expect(detail.accountLocked).toBe(true);
  await expect(page.getByRole('dialog')).not.toContainText(jobId);
  await expect(page.getByRole('row').filter({ hasText: '库存总包数' })).toContainText('通过');
  await screenshotWidths(page, 'b8a2/restore-report');
  await expect
    .poll(() => page.locator('.ant-modal-body').evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
});

test('B8a-2 无基线备份在确认与最终报告均明确未验证', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const response = await page.request.post('/api/v1/maintenance/backups', {
      headers: { Origin: 'http://127.0.0.1:5174', 'Idempotency-Key': randomUUID() },
      data: {},
    });
    expect(response.status()).toBe(202);
    const artifactId = (await response.json()).data.jobId;
    await expect
      .poll(async () => (await db.get('SELECT status FROM maintenance_jobs WHERE id=?', [artifactId]))?.status)
      .toBe('succeeded');
    await db.run('UPDATE backup_artifacts SET baseline=NULL WHERE id=?', [artifactId]);
    const file = await db.get('SELECT sha256 FROM backup_artifacts WHERE id=?', [artifactId]);
    await page.goto('/maintenance');
    await page
      .getByTestId('maintenance-artifacts')
      .getByRole('row')
      .filter({ hasText: String(file?.sha256) })
      .getByRole('button', { name: '恢复', exact: true })
      .click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText('无基线，仅核验结构与可读性', { exact: true })).toBeVisible();
    await modal.getByLabel('输入 RECOVER 确认').fill('RECOVER');
    await modal.getByRole('button', { name: '开始隔离恢复', exact: true }).click();
    const report = page.getByTestId('restore-report');
    await expect(report.getByText('无基线，仅核验结构与可读性', { exact: true })).toBeVisible();
    await expect(report.getByRole('row').filter({ hasText: '库存总包数' })).toContainText('未验证');
    await expect(report.getByText('核验通过', { exact: true })).toHaveCount(0);
    await screenshotWidths(page, 'b8a2/restore-no-baseline');
    await expect
      .poll(() => page.locator('.ant-modal-body').evaluate((element) => element.scrollWidth <= element.clientWidth))
      .toBe(true);
  } finally {
    await db.close();
  }
});

test('B8a-2 失败后可重开报告查看隔离副本及阶段记录', async ({ page }) => {
  const db = e2eDatabase();
  try {
    const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
    const options = localMaintenanceOptions({ ...adminConfig(), database: name });
    const file = await artifactFixture(db, {
      root: options.directory,
      at: new Date().toISOString(),
      content: `UPDATE \`${name}\`.stock SET packages=0;`,
    });
    await page.goto('/maintenance');
    const response = await page.request.post('/api/v1/maintenance/restores', {
      headers: { Origin: 'http://127.0.0.1:5174', 'Idempotency-Key': randomUUID() },
      data: { artifactId: file.id, confirmation: 'RECOVER' },
    });
    expect(response.status()).toBe(202);
    const jobId = (await response.json()).data.jobId;
    await expect
      .poll(async () => (await db.get('SELECT status FROM maintenance_jobs WHERE id=?', [jobId]))?.status)
      .toBe('failed');
    await page.reload();
    const row = page.getByTestId('maintenance-jobs').getByRole('row').filter({ hasText: '恢复' }).first();
    await row.getByRole('button', { name: '查看报告', exact: true }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText('恢复失败，证据已保留', { exact: true })).toBeVisible();
    await expect(modal.getByText('专用账号已锁定', { exact: true })).toBeVisible();
    await modal.getByText('阶段记录', { exact: true }).click();
    await expect(modal).toContainText('数据库错误编号');
    await expect(modal).not.toContainText(name);
    await screenshotWidths(page, 'b8a2/restore-failed');
  } finally {
    await db.close();
  }
});
