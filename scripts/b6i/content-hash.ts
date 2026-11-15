import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';

// Hash typed cell values, in row/column order; exclude only the header and totals row.
export async function contentHash(filename: string, count: number) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filename, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'cache',
    hyperlinks: 'ignore',
    entries: 'ignore',
  });
  const hash = createHash('sha256');
  const fieldHashes: ReturnType<typeof createHash>[] = [];
  let rows = 0;
  let columns: unknown[] = [];
  for await (const sheet of reader)
    for await (const row of sheet) {
      rows++;
      const cells = Array.from({ length: row.cellCount }, (_, i) => row.getCell(i + 1).value);
      if (rows === 1) {
        columns = cells;
        cells.forEach(() => fieldHashes.push(createHash('sha256')));
      } else if (rows <= count + 1) {
        hash.update(JSON.stringify(cells) + '\n');
        fieldHashes.forEach((field, i) => field.update(JSON.stringify(cells[i] ?? null) + '\n'));
      }
    }
  return {
    rows: rows - 2,
    columns,
    contentSha256: hash.digest('hex'),
    fields: fieldHashes.map((h) => h.digest('hex')),
  };
}
