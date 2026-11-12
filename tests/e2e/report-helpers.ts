import { expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';

export const reportQuery =
  'source=erp-product&fromDay=2026-01-01&toDay=2026-03-31&product=RPT-P&direction=asc&pageSize=20';
export const recordRows = (page: Page, kind: string) =>
  page.getByTestId('report-' + kind + '-list').locator('tbody tr[data-row-key]:has(td[data-export-field])');
export async function reportScreen(page: Page, kind: string) {
  return recordRows(page, kind).evaluateAll((rows) =>
    rows.map((r) => ({
      id: r.getAttribute('data-row-key')!,
      cells: Array.from(r.querySelectorAll('td[data-export-field]')).map((c) => (c.textContent ?? '').trim()),
    })),
  );
}
export async function compareReportDownload(
  page: Page,
  kind: string,
  scope: string,
  expected: Awaited<ReturnType<typeof reportScreen>>,
) {
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载 XLSX' }).click();
  const file = `.local/evidence/b3b-${kind}-${scope}.xlsx`;
  await (await pending).saveAs(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  const sheet = book.worksheets[0]!;
  expect(sheet.rowCount).toBe(expected.length + 2);
  const actual = expected.map((r, i) =>
    r.cells.map((_, j) => {
      const cell = sheet.getCell(i + 2, j + 1),
        value = cell.value;
      return value instanceof Date
        ? value.toISOString().slice(0, 19).replace('T', ' ')
        : cell.numFmt === '0.0000' && typeof value === 'number'
          ? value.toFixed(4)
          : cell.text;
    }),
  );
  expect(actual).toEqual(expected.map((r) => r.cells));
  const screenBalance = await page
    .getByTestId('report-reconciliation')
    .locator('tbody tr')
    .evaluateAll((rows) =>
      rows.map((r) =>
        Array.from(r.querySelectorAll('td'))
          .slice(1)
          .map((c) => c.textContent),
      ),
    );
  const reconciliation = book.getWorksheet('收发存对账')!;
  const exportedBalance = [2, 3].map((column) =>
    Array.from({ length: screenBalance[0]!.length }, (_, i) => {
      const v = reconciliation.getCell(i + 3, column).value;
      return typeof v === 'number' ? (column === 3 ? v.toFixed(4) : String(v)) : '—';
    }),
  );
  expect(exportedBalance).toEqual(screenBalance);
  const evidence = {
    kind,
    scope,
    rows: expected.length,
    fields: expected[0]?.cells.length,
    differences: 0,
    reconciliationDifferences: 0,
    last: expected.at(-1)?.id,
  };
  await writeFile(
    file.replace('.xlsx', '.json'),
    JSON.stringify({ evidence, expected, actual, screenBalance, exportedBalance }, null, 2),
  );
  console.log('B3B_SCREEN_XLSX', JSON.stringify(evidence));
}
