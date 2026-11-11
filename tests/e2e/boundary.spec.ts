import { expect, request } from '@playwright/test';
import { test } from './list-test';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { detailSchema } from '@wms/contracts';
import { e2eDatabase, post } from './inventory-helpers';
import { login } from '../../apps/api/src/features/auth/service';
import { hash } from '../../apps/api/src/shared/hash';

test('B4a R1 下载/离线事实/Web改车号/原正文补传', async ({ page }) => {
  const db = e2eDatabase(),
    pda = await request.newContext({ baseURL: 'http://127.0.0.1:4311/api/v1/' });
  try {
    const session = await login(
      db,
      { username: 'owner', password: 'e2e-only-password', channel: 'pda' },
      { username: 'owner', traceId: 'b4a-offline' },
    );
    const headers = { Authorization: `Bearer ${session.token}` };
    const created = await post(page, '/outbound', {
      customerCode: 'DEMO-CUST-1',
      warehouseCode: 'DEMO-WH',
      vehicleNo: 'B4A-原车号',
      lines: [{ productCode: 'ACR-032', plannedPackages: 1, plannedWeightGrams: 310000 }],
    });
    expect(created.status()).toBe(200);
    const plan = detailSchema.parse((await created.json()).data);
    const download = await pda.get(`scan/plans/${plan.id}`, { headers });
    expect(download.status()).toBe(200);
    const original = detailSchema.parse((await download.json()).data);
    const fact = {
      id: randomUUID(),
      barcode: 'DEMO-032-31',
      weightGrams: 310000,
      catalogVersion: 1,
      weightSource: 'catalog',
      deviceId: 'b4a-offline-device',
      scannedAt: new Date().toISOString(),
      planVersion: 1,
    };
    // Offline queue simulator: serialize once; no upload until the Web edit has completed.
    const offlineBody = JSON.stringify({
      schemaVersion: 2,
      fact,
      context: { outboundLineId: original.lines[0]!.id, sourceSpec: '合成规格', resolvedAt: null },
    });
    expect(Number((await db.get('SELECT COUNT(*) AS n FROM scan_facts WHERE plan_id=?', [plan.id]))?.n)).toBe(0);
    const lineBefore = await db.all('SELECT * FROM outbound_lines WHERE order_id=?', [plan.id]);
    await page.goto(`/outbound/${plan.id}/edit`);
    await expect(page.getByText('只能修改车号和备注，客户、仓库及明细保持不变。')).toBeVisible();
    await expect(page.getByLabel('计划包数')).toHaveCount(0);
    await page.getByLabel('车牌').fill('B4A-Web改后车号');
    await page.getByLabel('备注', { exact: true }).fill('离线期间仅改表头');
    const updated = page.waitForResponse(
      (r) => r.url().endsWith(`/outbound/${plan.id}`) && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: '保存修改' }).click();
    const response = await updated;
    expect(response.status()).toBe(200);
    expect(Object.keys(response.request().postDataJSON().plan).sort()).toEqual(['memo', 'vehicleNo']);
    await expect(page.getByText('B4A-Web改后车号', { exact: true })).toBeVisible();
    expect(await db.all('SELECT * FROM outbound_lines WHERE order_id=?', [plan.id])).toEqual(lineBefore);
    const upload = () =>
      pda.post(`scan/plans/${plan.id}/facts`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: offlineBody,
      });
    const uploaded = await upload();
    expect(uploaded.status()).toBe(200);
    const received = detailSchema.parse((await uploaded.json()).data);
    expect(received.lines[0]!.id).toBe(original.lines[0]!.id);
    const { planId: _plan, recordedBy: _by, receivedAt: _at, ...receivedBody } = received.facts[0]!;
    expect(receivedBody).toEqual(fact);
    expect((await db.get('SELECT payload_hash FROM scan_facts WHERE id=?', [fact.id]))?.payload_hash).toBe(
      hash(JSON.stringify({ planId: plan.id, fact })),
    );
    const retry = await upload();
    expect(retry.status()).toBe(200);
    expect((await retry.json()).data).toEqual(received);
    await page.reload();
    await expect(page.getByRole('button', { name: '编辑计划' })).toBeVisible();
    await page.screenshot({ path: '.local/evidence/b4a-r1-offline.png', fullPage: true });
    const evidence = {
      download: download.status(),
      webEdit: response.status(),
      upload: uploaded.status(),
      retry: retry.status(),
      lineId: original.lines[0]!.id,
      uuid: fact.id,
      offlineBody,
      lineIdUnchanged: true,
      uuidUnchanged: true,
      bodyUnchanged: true,
    };
    writeFileSync('.local/evidence/b4a-r1-e2e.json', JSON.stringify(evidence, null, 2));
    console.log('B4A_R1_E2E', JSON.stringify(evidence));
  } finally {
    await pda.dispose();
    await db.close();
  }
});

test('B4a R2/R3 商品可维护；605条列表及单据选择器分页/搜索/已选回显/末条可达', async ({ page }) => {
  test.setTimeout(90000);
  const db = e2eDatabase();
  const prefix = `B4A-${randomUUID().slice(0, 6)}-`,
    first = `${prefix}0001`,
    last = `${prefix}0605`;
  const catalogs = [
    ['products', '商品'],
    ['warehouses', '仓库'],
    ['customers', '客户'],
    ['suppliers', '供应商'],
  ] as const;
  try {
    for (const [catalog] of catalogs) {
      const rows = Array.from({ length: 605 }, (_, i) => [
        `${prefix}${String(i + 1).padStart(4, '0')}`,
        `翻页验收-${i + 1}`,
      ]);
      await db.run(
        `INSERT INTO master_${catalog}(code,name,created_at,updated_at${catalog === 'products' ? ',source_kind,origin_kind,inventory_eligible' : ''}) VALUES ${rows.map(() => `(?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)${catalog === 'products' ? ",'erp-product','legacy',1" : ''})`).join(',')}`,
        rows.flat(),
      );
    }
    await page.goto('/master-data');
    for (const [catalog, label] of catalogs) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      const panel = page.getByRole('tabpanel', { name: label, exact: true });
      if (catalog === 'products') {
        await expect(panel.getByRole('button', { name: '新增基础资料', exact: true })).toBeVisible();
      }
      await panel.getByLabel('搜索基础资料').fill(prefix);
      await panel.getByLabel('搜索基础资料').press('Enter');
      await expect(panel.getByText('共 605 条', { exact: true })).toBeVisible();
      await panel.getByTitle('2', { exact: true }).click();
      await expect(panel.getByText(`${prefix}0021`, { exact: true })).toBeVisible();
      await panel.getByTitle('31', { exact: true }).click();
      await expect(panel.getByText(last, { exact: true })).toBeVisible();
      await panel.getByLabel('搜索基础资料').fill('翻页验收-605');
      await panel.getByLabel('搜索基础资料').press('Enter');
      await expect(panel.getByText('共 1 条', { exact: true })).toBeVisible();
      await expect(panel.getByText(last, { exact: true })).toBeVisible();
    }
    await page.goto('/inbound/new');
    const product = page.getByLabel('商品', { exact: true });
    await product.fill(prefix);
    await expect(page.locator('.ant-select-item-option').filter({ hasText: first })).toBeVisible();
    await page.getByRole('button', { name: '下一页资料' }).click();
    await expect(page.locator('.ant-select-item-option').filter({ hasText: `${prefix}0021` })).toBeVisible();
    await product.fill(last);
    const selectedRead = page.waitForResponse((r) => r.url().endsWith(`/master/products/${last}`));
    await page.locator('.ant-select-item-option').filter({ hasText: last }).click();
    // Refetch on reload is unnecessary: the exact-code query runs as soon as selection changes.
    const selectedLabel = page.locator('.ant-select-content').filter({ has: product });
    await expect(selectedLabel).toContainText(`翻页验收-605${last}`);
    expect((await selectedRead).status()).toBe(200);
    await product.fill(first);
    await expect(page.locator('.ant-select-item-option').filter({ hasText: first })).toBeVisible();
    await product.press('Escape');
    await expect(selectedLabel).toContainText(`翻页验收-605${last}`);
    await page.screenshot({ path: '.local/evidence/b4a-r3-selected.png', fullPage: true });
    console.log(
      'B4A_R3_E2E',
      JSON.stringify({
        catalogs: 4,
        rowsEach: 605,
        listPages: [2, 31],
        dropdownPages: [1, 2],
        nameSearch: true,
        codeSearch: true,
        exactCode: last,
        selectedAfterSearch: last,
        productEditable: true,
      }),
    );
  } finally {
    for (const [catalog] of catalogs) await db.run(`DELETE FROM master_${catalog} WHERE code LIKE ?`, [prefix + '%']);
    await db.close();
  }
});
