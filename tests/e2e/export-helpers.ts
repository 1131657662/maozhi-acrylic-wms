import { expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';

export async function screenRows(page: Page, kind: string) {
  return page
    .getByTestId(kind + '-list')
    .locator('tbody tr[data-row-key]')
    .evaluateAll((rows) =>
      rows.map((row) => ({
        id: row.getAttribute('data-row-key')!,
        cells: Array.from(row.querySelectorAll('td[data-export-field]')).map((cell) => ({
          key: cell.getAttribute('data-export-field')!,
          text: (cell.textContent ?? '').trim(),
        })),
      })),
    );
}
function excelText(cell: ExcelJS.Cell): string {
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 19).replaceAll('-', '/').replace('T', ' ');
  if (cell.numFmt === '0.0000' && typeof cell.value === 'number') return cell.value.toFixed(4);
  return cell.text;
}
export async function downloadAndCompare(
  page: Page,
  input: { kind: string; scope: string; expected: Awaited<ReturnType<typeof screenRows>> },
) {
  await expect(page.getByRole('link', { name: '下载 XLSX' })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载 XLSX' }).click();
  const download = await pending;
  await mkdir('.local/evidence', { recursive: true });
  const filename = `.local/evidence/b1b2-${input.kind}-${input.scope}-verified.xlsx`;
  await download.saveAs(filename);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(filename);
  const sheet = book.worksheets[0]!;
  expect(sheet.rowCount).toBe(input.expected.length + 2);
  const actual = input.expected.map((_row, i) =>
    input.expected[0]!.cells.map((_cell, c) => excelText(sheet.getCell(i + 2, c + 1))),
  );
  const expected = input.expected.map((row) => row.cells.map((c) => c.text));
  expect(actual).toEqual(expected);
  const headers = page.getByTestId('export-fields');
  const labels = (sheet.getRow(1).values as string[]).slice(1);
  expect(await headers.textContent()).toBe('字段顺序：' + labels.join('、'));
  const totals: Record<string, string> = {};
  for (let c = 1; c <= sheet.columnCount; c++)
    if (sheet.getColumn(c).numFmt === '0' || sheet.getColumn(c).numFmt === '0.0000') {
      const key = input.expected[0]!.cells[c - 1]!.key;
      const total = excelText(sheet.getCell(sheet.rowCount, c));
      totals[key] = total;
      await expect(page.getByTestId('export-total-' + key)).toHaveText(total);
      const sum = actual.reduce((n, row) => n + Math.round(Number(row[c - 1]) * 10000), 0) / 10000;
      expect(Number(total)).toBe(sum);
    }
  const report = {
    kind: input.kind,
    scope: input.scope,
    rows: actual.length,
    fields: labels,
    comparedCells: actual.length * labels.length,
    differences: 0,
    totals,
    last: actual.at(-1),
  };
  await writeFile(filename.replace('.xlsx', '.json'), JSON.stringify({ report, expected, actual }, null, 2));
  console.log('B1B2_SCREEN_XLSX', JSON.stringify(report));
}
