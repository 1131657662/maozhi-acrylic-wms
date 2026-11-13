import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { test, expect, loginCatalog, uploadFile, publishFile, catalogShot } from './catalog-helpers';
import { catalogSnapshot } from '../../apps/api/tests/catalog-fixture';

test('catalog-error-csv：三条错误随422返回且下载内容一致', async ({ page, catalogDb }) => {
  await loginCatalog(page);
  const before = await catalogSnapshot(catalogDb);
  const pending = page.waitForResponse((response) => response.url().includes('/catalog/uploads?'));
  await uploadFile(page, '规格 A nope\n规格 B 0\n坏行');
  const response = await pending;
  expect(response.status()).toBe(422);
  expect((await response.json()).data.errors).toHaveLength(3);
  await expect(page.getByTestId('catalog-upload-errors')).toContainText('发现 3 条错误，整版未导入');
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载错误清单' }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('条码目录错误清单.csv');
  expect(await readFile((await download.path())!, 'utf8')).toBe(
    '\uFEFF"行号","原始行内容","原因"\r\n' +
      '"1","规格 A nope","重量必须为正十进制 千克"\r\n' +
      '"2","规格 B 0","重量为零、负数或超出支持范围"\r\n' +
      '"3","坏行","缺少规格、条码或重量"\r\n',
  );
  expect(await catalogSnapshot(catalogDb)).toEqual(before);
  await catalogShot(page, 'b6d3a-errors');
});

test('catalog-error-limit：超过500条展示截断提示且CSV仅有500条', async ({ page, catalogDb }) => {
  await loginCatalog(page);
  const before = await catalogSnapshot(catalogDb);
  await uploadFile(page, Array.from({ length: 501 }, (_, i) => `错误 ROW-${i} 0`).join('\n'));
  await expect(page.getByTestId('catalog-upload-errors')).toContainText('错误过多，仅显示前 500 条');
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载错误清单' }).click();
  const csv = await readFile((await (await pendingDownload).path())!, 'utf8');
  expect(csv.trimEnd().split('\r\n')).toHaveLength(501);
  expect(csv).toContain('"500","错误 ROW-499 0"');
  expect(csv).not.toContain('ROW-500');
  expect(await catalogSnapshot(catalogDb)).toEqual(before);
  await catalogShot(page, 'b6d3a-error-limit');
});

test('catalog-current-xlsx：第二页导出全部搜索命中且计数一致', async ({ page, catalogDb }) => {
  await loginCatalog(page);
  const rows = Array.from({ length: 53 }, (_, i) => `导出规格 MATCH-${String(i).padStart(3, '0')} 301.5`);
  await uploadFile(page, [...rows, '不命中 OTHER 300'].join('\n'));
  await publishFile(page);
  await expect(page.getByText('整版发布成功，已有扫码记录未改变')).toBeVisible();
  await page.getByLabel('搜索条码或规格').fill('MATCH-');
  await page.getByLabel('搜索条码或规格').press('Enter');
  const section = page.getByTestId('catalog-directory-search');
  await expect(section).toContainText('共 53 条');
  await section.getByTitle('2', { exact: true }).click();
  await expect(section.getByRole('cell', { name: 'MATCH-052' })).toBeVisible();
  const before = await catalogSnapshot(catalogDb);
  const pendingDownload = page.waitForEvent('download');
  await section.getByRole('button', { name: '导出当前视图' }).click();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await (await pendingDownload).path())!);
  const sheet = workbook.getWorksheet('导出记录')!;
  expect(sheet.rowCount).toBe(55);
  expect(sheet.getRow(1).values.slice(1)).toEqual(['条码', '规格', '重量（千克）', '版本']);
  expect(Array.from({ length: 53 }, (_, i) => sheet.getRow(i + 2).getCell(1).value)).toEqual(
    rows.map((_, i) => `MATCH-${String(i).padStart(3, '0')}`),
  );
  expect(sheet.getRow(2).getCell(3).value).toBe(301.5);
  expect(sheet.getRow(2).getCell(4).value).toBe('第 2 版');
  expect(await catalogSnapshot(catalogDb)).toEqual(before);
  await catalogShot(page, 'b6d3a-export');
  await page.getByLabel('搜索条码或规格').fill('ABSENT');
  await page.getByLabel('搜索条码或规格').press('Enter');
  await expect(section.getByText('没有匹配的条码')).toBeVisible();
  await expect(section.getByRole('button', { name: '导出当前视图' })).toBeDisabled();
});

test('catalog-arbitrary-diff：版本历史选择两版并区分五类条目', async ({ page, catalogDb }) => {
  await loginCatalog(page);
  await uploadFile(page, '旧规格 WEIGHT-A 300\n旧规格 SPEC-B 300\n旧规格 REMOVED-C 300\n旧规格 STABLE-D 300');
  await expect(page.getByText('第 2 版待发布', { exact: true })).toBeVisible();
  await uploadFile(page, '旧规格 WEIGHT-A 301\n新规格 SPEC-B 300\n旧规格 STABLE-D 300\n新规格 ADDED-E 300');
  await expect(page.getByText('第 3 版待发布', { exact: true })).toBeVisible();
  const before = await catalogSnapshot(catalogDb);
  await page.getByRole('button', { name: '版本历史', exact: true }).click();
  await page.getByRole('button', { name: '将第 2 版设为对比基准' }).click();
  await page.getByRole('button', { name: '与第 3 版对比' }).click();
  const dialog = page.getByRole('dialog', { name: '目录版本对比' });
  await expect(dialog).toContainText('第 2 → 3 版差异');
  for (const [barcode, kind] of [
    ['ADDED-E', '新增'],
    ['REMOVED-C', '消失'],
    ['WEIGHT-A', '重量变更'],
    ['SPEC-B', '规格变更'],
    ['STABLE-D', '未变化'],
  ]) {
    await expect(dialog.getByRole('row').filter({ hasText: barcode })).toContainText(kind!);
  }
  await dialog.getByRole('radio', { name: '规格变更', exact: true }).check();
  await expect(dialog).toContainText('共 1 条');
  await expect(dialog.getByRole('row').filter({ hasText: 'WEIGHT-A' })).toHaveCount(0);
  expect(await catalogSnapshot(catalogDb)).toEqual(before);
  await catalogShot(page, 'b6d3a-compare');
});
