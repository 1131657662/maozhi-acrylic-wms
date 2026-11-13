import { test, expect, loginCatalog, uploadFile, publishFile, catalogShot } from './catalog-helpers';

test('catalog-query-trace-lookup：搜索当前目录并查看候选轨迹与只读扫描结果', async ({ page }) => {
  await loginCatalog(page);
  await uploadFile(page, await publishedCatalogText());
  await publishFile(page);
  await uploadFile(page, 'H815B FIBER TRACE-BARCODE-001 302.0\nNEW FIBER CANDIDATE-BARCODE-004 500.0');
  await searchCurrentBarcode(page);
  await openBarcodeTrace(page);
  await runBarcodeLookup(page);
  await catalogShot(page, 'b6d2-query');
});

async function publishedCatalogText() {
  const pageRows = Array.from(
    { length: 51 },
    (_, index) => `PAGE SPEC PAGE-${String(index + 1).padStart(3, '0')} 400.0`,
  );
  return [
    'H815B FIBER TRACE-BARCODE-001 300.0',
    'H815B FIBER TRACE-BARCODE-002 301.0',
    'N32 FIBER OTHER-BARCODE-003 350.0',
    ...pageRows,
  ].join('\n');
}

async function searchCurrentBarcode(page: Parameters<typeof loginCatalog>[0]) {
  await page.getByLabel('搜索条码或规格').fill('TRACE-BARCODE-001');
  await page.keyboard.press('Enter');
  await expect(
    page.getByTestId('catalog-directory-search').getByRole('table').getByText('TRACE-BARCODE-001'),
  ).toBeVisible();
  await expect(page.getByText('当前目录 · 第 2 版')).toBeVisible();
}

async function openBarcodeTrace(page: Parameters<typeof loginCatalog>[0]) {
  await page.getByRole('button', { name: '查看版本轨迹 TRACE-BARCODE-001' }).click();
  await expect(page.getByText('条码版本轨迹 · TRACE-BARCODE-001')).toBeVisible();
  const trace = page.getByRole('dialog');
  await expect(trace.getByText('已发布', { exact: true })).toBeVisible();
  await expect(trace.getByText('待发布', { exact: true })).toBeVisible();
}

async function runBarcodeLookup(page: Parameters<typeof loginCatalog>[0]) {
  await page.keyboard.press('Escape');
  const barcodeInput = page.getByLabel('扫描测试条码');
  await barcodeInput.fill('TRACE-BARCODE-001');
  await barcodeInput.press('Enter');
  const lookup = page.getByTestId('catalog-barcode-lookup');
  await expect(lookup.getByText('当前目录有效', { exact: true })).toBeVisible();
  await expect(lookup.getByText('300.000 千克', { exact: true })).toBeVisible();
}
