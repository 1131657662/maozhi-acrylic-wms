import { test, expect, loginCatalog } from './catalog-helpers';
import { prepareHandoff, handoffPlan } from '../../apps/api/tests/handoff-fixture';
import { startHandoff } from '../../apps/api/src/features/handoff/start';
import { registerRecords } from '../../apps/api/src/features/handoff/records';
import { hash } from '../../apps/api/src/shared/hash';
import { actor } from '../../apps/api/tests/fixture';
import { recordFact } from '../../apps/api/src/features/scan/service';
import { handoffDetail } from '../../apps/api/src/features/handoff/read';
import { publicationGate } from '../../apps/api/src/features/catalog/gate';
import type { Page } from '@playwright/test';

async function shot(page: Page, name: string) {
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    if (await page.getByRole('dialog', { name: '设备交接明细 · 原事实保留', exact: true }).isVisible())
      await page.getByText('设备交接明细 · 原事实保留', { exact: true }).click();
    else await page.getByText('发布门禁 · 设备与待补传队列', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/evidence/b1c2-${name}-${width}.png`, fullPage: true });
  }
}
test('catalog-handoff-batch：60条按原单批量交接，门禁展示未收妥与解除条件', async ({ page, catalogDb: db }) => {
  const { header, records, facts } = await prepareHandoff(db);
  await startHandoff(db, header, actor);
  for (let i = 0; i < 60; i += 3)
    await registerRecords(
      db,
      header.id,
      records.slice(i, i + 3).map((r) => ({
        planId: handoffPlan,
        rawPayload: r.payload,
        payloadSha: hash(r.payload),
        localState: r.state as 'pending' | 'failed',
      })),
    );
  await loginCatalog(page);
  await expect(page.getByText('发布门禁 · 设备与待补传队列', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认交接', exact: true })).toBeDisabled();
  await shot(page, 'handoff-blocked');
  await page.getByRole('button', { name: '查看记录', exact: true }).click();
  await expect(page.getByText('已收妥 2/60 · 未收妥 58', { exact: true })).toBeVisible();
  await page.getByLabel('原出库单', { exact: true }).click();
  await page.getByTitle(handoffPlan, { exact: true }).click();
  await page.getByLabel('ERP 作业行', { exact: true }).click();
  await page.getByTitle('TEST-ERP · 隔离验证商品 · 61 包', { exact: true }).click();
  await page.getByRole('button', { name: '批量确认本单 58 条', exact: true }).click();
  await page.getByRole('button', { name: '批量确认原单作业行', exact: true }).click();
  await expect(page.getByText('待确认原单作业行 58 条：可按单批量处理，无需逐条点击')).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: /^将原单 / })).not.toBeVisible();
  await shot(page, 'handoff-records');
  const detail = await handoffDetail(db, header.id);
  for (const fact of facts)
    await recordFact(db, {
      planId: handoffPlan,
      fact,
      actor,
      context: detail.items.find((r) => r.factId === fact.id)!.context!,
    });
  await page.getByRole('button', { name: '刷新收妥结果', exact: true }).click();
  await expect(page.getByText('已收妥 60/60 · 未收妥 0', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '刷新交接清单', exact: true }).click();
  await page.getByRole('button', { name: '确认交接', exact: true }).click();
  await page.getByRole('button', { name: '确认交接完成', exact: true }).click();
  await expect(page.getByText('已确认交接', { exact: true })).toBeVisible();
  expect((await publicationGate(db, true)).allowed).toBe(true);
  await shot(page, 'handoff-ready');
  console.log(
    'B1C2_E2E manifest=60 received_before=2 unresolved=58 batch_action=1 received_after=60 gate=allowed widths=1440,1280',
  );
});
