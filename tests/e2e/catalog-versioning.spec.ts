import {
  test,
  expect,
  loginCatalog,
  uploadFile,
  publishFile,
  catalogShot,
  pdaToken,
  catalogPost,
} from './catalog-helpers';
import { fact } from '../../apps/api/tests/fixture';

test('catalog-mixed-version-continuation：Web 发布后旧单继续扫码冻结确认', async ({ page, catalogDb: db }) => {
  await db.run("UPDATE outbound_lines SET planned_packages=3,planned_weight_tonnes='0.9000' WHERE id='DEMO-001-L1'");
  await loginCatalog(page);
  await catalogShot(page, 'upload');
  const token = await pdaToken(page);
  for (const item of [fact(), fact({ barcode: 'DEMO-032-12', weightGrams: 297500 })]) {
    const response = await catalogPost(
      page,
      '/scan/plans/DEMO-001/facts',
      {
        schemaVersion: 2,
        fact: item,
        context: { outboundLineId: 'DEMO-001-L1', sourceSpec: '合成规格', resolvedAt: null },
      },
      token,
    );
    expect(response.status()).toBe(200);
  }
  const before = (await (await page.request.get('/api/v1/outbound/DEMO-001')).json()).data;
  const factsBefore = await db.all('SELECT * FROM scan_facts ORDER BY id');
  await uploadFile(
    page,
    '新版规格 NEW-C 300\n合成规格 DEMO-032-21 281\n合成规格 DEMO-032-22 320\n合成规格 DEMO-032-31 310\n合成规格 DEMO-032-32 290',
  );
  await expect(page.getByText('新增 1 条', { exact: true })).toBeVisible();
  await expect(page.getByText('消失 2 条', { exact: true })).toBeVisible();
  await expect(page.getByText('重量变更 1 条', { exact: true })).toBeVisible();
  await catalogShot(page, 'diff');
  await publishFile(page);
  await expect(page.getByText('整版发布成功，已有扫码记录未改变')).toBeVisible();
  const after = (await (await page.request.get('/api/v1/outbound/DEMO-001')).json()).data;
  expect(after).toEqual(before);
  expect(await db.all('SELECT * FROM scan_facts ORDER BY id')).toEqual(factsBefore);
  const response = await catalogPost(
    page,
    '/scan/plans/DEMO-001/facts',
    {
      schemaVersion: 2,
      fact: fact({ barcode: 'NEW-C', weightGrams: 300000, catalogVersion: 2 }),
      context: { outboundLineId: 'DEMO-001-L1', sourceSpec: '新版规格', resolvedAt: null },
    },
    token,
  );
  expect(response.status()).toBe(200);
  const mixed = (await response.json()).data;
  expect(mixed.facts.map((f: { catalogVersion: number }) => f.catalogVersion).sort()).toEqual([1, 1, 2]);
  const freeze = await catalogPost(
    page,
    '/scan/plans/DEMO-001/submit',
    { revision: mixed.revision, digest: mixed.digest },
    token,
  );
  expect(freeze.status()).toBe(200);
  const frozen = (await freeze.json()).data;
  await page.getByRole('button', { name: '版本历史', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeInViewport({ ratio: 1 });
  await expect(page.getByText('当前活动版本', { exact: true })).toBeVisible();
  await catalogShot(page, 'history');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await uploadFile(page, '');
  await publishFile(page);
  await expect(page.getByText('当前目录无有效条码；已有扫码记录仍可结束扫码并确认出库')).toBeVisible();
  const confirm = await catalogPost(page, '/outbound/DEMO-001/confirm', {
    revision: frozen.revision,
    digest: frozen.digest,
    lines: frozen.lines.map((l) => ({
      lineId: l.id,
      actualPackages: l.actualPackages,
      actualWeightGrams: l.actualWeightGrams,
    })),
  });
  expect(confirm.status()).toBe(200);
  expect((await confirm.json()).data.status).toBe('confirmed');
  console.log('B1C1_E2E mixed=[1,1,2] old_facts_unchanged=true old_digest_unchanged=true empty_v3_confirm=success');
});

test('catalog-duplicate：重复文件不建版，只有二次确认才重建', async ({ page, catalogDb: db }) => {
  await loginCatalog(page);
  await uploadFile(page, '目录规格 CATALOG-A 300');
  await publishFile(page);
  await expect(page.getByText('整版发布成功，已有扫码记录未改变')).toBeVisible();
  const before = await db.get('SELECT COUNT(*) AS n FROM catalog_versions');
  await uploadFile(page, '目录规格 CATALOG-A 300');
  await expect(page.getByText('与第 2 版内容一致', { exact: true })).toBeVisible();
  expect(await db.get('SELECT COUNT(*) AS n FROM catalog_versions')).toEqual(before);
  await catalogShot(page, 'duplicate');
  await page.getByRole('button', { name: '仍需重建' }).click();
  expect(await db.get('SELECT COUNT(*) AS n FROM catalog_versions')).toEqual(before);
  await page.getByRole('button', { name: '确认重建版本', exact: true }).click();
  await expect(page.getByText('第 3 版待发布', { exact: true })).toBeVisible();
  console.log(
    'B1C1_E2E_DUPLICATE versions_before=2 versions_after=2 message=与第 2 版内容一致 explicit_confirmation_creates=3',
  );
});
