import { test, expect, loginCatalog, uploadFile, catalogShot } from './catalog-helpers';
import { prepareHandoff } from '../../apps/api/tests/handoff-fixture';
import { startHandoff } from '../../apps/api/src/features/handoff/start';
import { actor } from '../../apps/api/tests/fixture';

test('整版放弃、刷新追溯、同内容重传及显式重建保留证据', async ({ page, catalogDb }) => {
  await loginCatalog(page);
  await uploadFile(page, '放弃验收 ABANDON-E2E 300');
  const card = page.getByTestId('catalog-candidate');
  await expect(card.getByText('第 2 版待发布')).toBeVisible();
  await expect(
    page.getByTestId('candidate-handoff-evidence').getByText('暂无已登记交接证据，设备情况未知'),
  ).toBeVisible();
  await card.getByRole('button', { name: '放弃整版候选', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认放弃整版', exact: true })).toBeDisabled();
  await page.getByLabel('放弃原因', { exact: true }).fill('合成验收：供应文件待修正');
  await catalogShot(page, 'b6d3b-abandon-confirm');
  await page.getByRole('button', { name: '确认放弃整版', exact: true }).click();
  await expect(card.getByText('第 2 版已放弃')).toBeVisible();
  await expect(card.getByText('操作人：owner')).toBeVisible();
  await expect(card.getByRole('button', { name: '发布整版', exact: true })).toBeDisabled();
  await catalogShot(page, 'b6d3b-abandoned');
  await page.reload();
  await page.getByLabel('文件编码', { exact: true }).click();
  await page.getByTitle('UTF-8', { exact: true }).click();
  await page.getByRole('button', { name: '版本历史', exact: true }).click();
  await page.getByRole('button', { name: '查看第 2 版放弃记录' }).click();
  await expect(card.getByText('合成验收：供应文件待修正', { exact: false })).toBeVisible();
  await uploadFile(page, '放弃验收 ABANDON-E2E 300');
  await expect(page.getByText('与第 2 版内容一致，该候选已放弃；如需重新处理，请显式重建候选')).toBeVisible();
  expect(Number((await catalogDb.get('SELECT COUNT(*) AS n FROM catalog_versions'))?.n)).toBe(2);
  await card.getByRole('button', { name: '重建候选', exact: true }).click();
  await page.getByRole('button', { name: '确认重建候选', exact: true }).click();
  await expect(card.getByText('第 3 版待发布')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(Number((await catalogDb.get('SELECT COUNT(*) AS n FROM catalog_candidate_abandons'))?.n)).toBe(1);
  await catalogShot(page, 'b6d3b-rebuilt');
});

test('候选基准交接摘要只读，放弃后仍保留60条预期与未收齐数', async ({ page, catalogDb }) => {
  const handoff = await prepareHandoff(catalogDb);
  await startHandoff(catalogDb, handoff.header, actor);
  await loginCatalog(page);
  await uploadFile(page, '交接验收 EVIDENCE-E2E 300');
  const evidence = page.getByTestId('candidate-handoff-evidence');
  await expect(evidence.getByText('预期扫码记录数：60 · 已登记：0 · 已收妥：0 · 未收齐：60')).toBeVisible();
  await page.getByTestId('catalog-candidate').getByRole('button', { name: '放弃整版候选' }).click();
  await page.getByLabel('放弃原因', { exact: true }).fill('合成验收：保留交接证据');
  await page.getByRole('button', { name: '确认放弃整版' }).click();
  await expect(page.getByText('第 2 版已放弃')).toBeVisible();
  await expect(evidence.getByText('预期扫码记录数：60 · 已登记：0 · 已收妥：0 · 未收齐：60')).toBeVisible();
  await catalogShot(page, 'b6d3b-handoff-evidence');
});
