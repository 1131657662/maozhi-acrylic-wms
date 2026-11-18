import { expect } from '@playwright/test';
import { test } from './list-test';
import { post } from './inventory-helpers';

test('F04 二百条粘贴逐批展示，第二批响应失败后复用原键、原正文', async ({ page }) => {
  test.setTimeout(120000);
  const result = await post(page, '/outbound', {
    warehouseCode: 'DEMO-WH',
    customerCode: 'DEMO-CUST-1',
    vehicleNo: '批量验收',
    lines: [{ productCode: 'ACR-032', plannedPackages: 200, plannedWeightGrams: 60000000 }],
  });
  expect(result.status()).toBe(200);
  const { id } = (await result.json()).data;
  const barcodes = Array.from({ length: 200 }, (_, index) => `PASTE-${String(index).padStart(6, '0')}`);
  const requests: { key: string | undefined; body: string | null }[] = [];
  await page.route(`**/outbound/${id}/scan-candidates?**`, (route) => {
    const barcode = new URL(route.request().url()).searchParams.get('query');
    return route.fulfill({
      json: {
        code: 'OK',
        message: '成功',
        data: {
          total: 1,
          page: 1,
          pageSize: 20,
          items: [{ barcode, sourceSpec: null, weightGrams: 300000, status: 'available', attribution: 'catalog' }],
        },
      },
    });
  });
  await page.route(`**/outbound/${id}/scan-records/batch`, async (route) => {
    const req = route.request();
    requests.push({ key: req.headers()['idempotency-key'], body: req.postData() });
    if (requests.length === 2) return route.fulfill({ status: 413, body: '' });
    const items = req
      .postDataJSON()
      .records.map((item: { barcode: string; productCode: string }) => ({ ...item, ok: true, reason: '已计入' }));
    await route.fulfill({ json: { code: 'OK', message: '成功', data: { items } } });
  });
  await page.goto(`/outbound/${id}`);
  await page.getByRole('button', { name: '清点工作台', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: /清点工作台/ });
  await drawer.getByText('批量粘贴', { exact: true }).click();
  await drawer.getByLabel('每行一个条码', { exact: true }).fill(barcodes.join('\n'));
  await drawer.getByRole('button', { name: '检查并加入待录' }).click();
  await drawer.getByRole('button', { name: '仅计入有效 200 条' }).click();
  await expect(page.getByText('提交内容过大，请分批提交', { exact: true }).first()).toBeVisible();
  await expect(drawer.getByText('已计入', { exact: true }).first()).toBeVisible();
  await drawer.getByRole('button', { name: '仅计入有效 100 条' }).click();
  await expect(drawer.getByRole('button', { name: '仅计入有效 0 条' })).toBeDisabled();
  expect(requests).toHaveLength(3);
  const sent = requests.map((request) =>
    JSON.parse(request.body!).records.map((item: { barcode: string }) => item.barcode),
  );
  expect(sent).toEqual([barcodes.slice(0, 100), barcodes.slice(100), barcodes.slice(100)]);
  expect(requests[0]!.key).toBeTruthy();
  expect(requests[1]!.key).toBeTruthy();
  expect(requests[1]!.key).not.toBe(requests[0]!.key);
  expect(requests[2]).toEqual(requests[1]);
});
