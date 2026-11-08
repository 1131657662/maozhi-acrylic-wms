import { test, expect, loginCatalog, uploadFile, publishFile, catalogShot, pdaToken } from './catalog-helpers';
import { catalogSnapshot } from '../../apps/api/tests/catalog-fixture';

test('catalog-invalid-snapshot-rejected：坏文件整版拒绝并保留文件', async ({ page, catalogDb: db }) => {
  await loginCatalog(page);
  const before = await catalogSnapshot(db);
  await uploadFile(page, '规格 BROKEN 非数字');
  await expect(page.getByText(/第 1 行：重量必须为正十进制 kg/)).toBeVisible();
  await expect(page.getByText('sku.txt', { exact: true })).toBeVisible();
  expect(await catalogSnapshot(db)).toEqual(before);
  await catalogShot(page, 'invalid');
  console.log('B1C1_E2E_INVALID status=422 all_business_tables_unchanged=true file_retained=true');
});

test('catalog-publish-failure-keeps-v1：数据库中途失败可用原键恢复', async ({ page, catalogDb: db }) => {
  await loginCatalog(page);
  await uploadFile(page, '规格 RECOVERY-A 300');
  await expect(page.getByText('第 2 版待发布', { exact: true })).toBeVisible();
  const before = await catalogSnapshot(db);
  await db.run(
    "CREATE TRIGGER fail_publish AFTER UPDATE ON catalog_head FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CATALOG E2E rollback'",
  );
  await publishFile(page);
  await expect(page.getByText(/发布未完成或结果待核验/)).toBeVisible();
  expect(await catalogSnapshot(db)).toEqual(before);
  expect((await db.get('SELECT active_version_id FROM catalog_head'))?.active_version_id).toBe(1);
  await catalogShot(page, 'rollback');
  await db.run('DROP TRIGGER fail_publish');
  await publishFile(page);
  await expect(page.getByText('整版发布成功，已有事实未改变')).toBeVisible();
  console.log('B1C1_E2E_ROLLBACK after_head_failure=current_v1 all_tables_unchanged=true same_key_retry=success');
});

test('catalog-publish-response-lost：提交后丢响应自动核验不重复发布', async ({ page, catalogDb: db }) => {
  await loginCatalog(page);
  await uploadFile(page, '规格 LOST-A 300');
  await page.route(
    '**/catalog/versions/*/publish',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await publishFile(page);
  await expect(page.getByText('整版发布成功，已有事实未改变')).toBeVisible();
  expect((await db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='catalog.publish'"))?.n).toBe('1');
  console.log('B1C1_E2E_LOST_RESPONSE recovered=true publish_audits=1');
});

test('catalog-legacy-gate：旧协议请求产生持久门禁并显示原因', async ({ page, catalogDb: db }) => {
  await loginCatalog(page);
  const token = await pdaToken(page);
  const legacy = await page.request.get('/api/v1/scan/catalog', { headers: { Authorization: `Bearer ${token}` } });
  expect(legacy.status()).toBe(200);
  await page.getByRole('button', { name: '刷新状态', exact: true }).click();
  await expect(page.getByText('暂不能发布新版本', { exact: true })).toBeVisible();
  await expect(page.getByText(/旧协议请求 1 次/)).toBeVisible();
  await uploadFile(page, '规格 BLOCKED-A 300');
  await expect(page.getByRole('button', { name: '发布整版', exact: true })).toBeDisabled();
  expect((await db.get('SELECT active_version_id FROM catalog_head'))?.active_version_id).toBe(1);
  await catalogShot(page, 'gate');
  console.log('B1C1_E2E_GATE legacy_requests=1 publish_disabled=true current=v1');
});
