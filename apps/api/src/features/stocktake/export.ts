import ExcelJS from 'exceljs';
import {
  STOCKTAKE_EXPORT_PAGE_SIZE,
  WEB_EXPORT_MAX_ROWS,
  stocktakeCopy,
  stocktakeQuerySchema,
  tonnes,
  type PublicStocktakeLine,
  type Stocktake,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { getStocktake, stocktakeLines } from './read-model.ts';
import { isBlindHidden, publicLine } from './visibility.ts';

function columns(take: Stocktake): string[] {
  const copy = stocktakeCopy;
  return [
    copy.warehouse,
    copy.productCode,
    copy.productName,
    ...(!isBlindHidden(take) ? [copy.bookPackages, copy.bookTonnes] : []),
    copy.actualPackages,
    copy.actualTonnes,
    ...(!isBlindHidden(take) ? [copy.deltaPackages, copy.deltaTonnes] : []),
  ];
}
function cells(warehouse: string, line: PublicStocktakeLine, kind: 'blank' | 'result') {
  const actual = kind === 'result' ? line.actual : null;
  const values: (string | number)[] = [warehouse, line.productCode, line.productName];
  if (line.visibility === 'visible') values.push(line.snapshot.packages, tonnes(line.snapshot.weightGrams));
  values.push(actual?.packages ?? '', actual ? tonnes(actual.weightGrams) : '');
  if (line.visibility === 'visible')
    values.push(
      actual ? (line.packagesDelta ?? '') : '',
      actual && line.weightDeltaGrams !== null ? tonnes(line.weightDeltaGrams) : '',
    );
  return values;
}
async function appendRows(
  db: Database,
  sheet: ExcelJS.Worksheet,
  input: { take: Stocktake; kind: 'blank' | 'result' },
) {
  for (let offset = 0; offset < input.take.lineCount; offset += STOCKTAKE_EXPORT_PAGE_SIZE) {
    const query = stocktakeQuerySchema.parse({
      page: offset / STOCKTAKE_EXPORT_PAGE_SIZE + 1,
      pageSize: STOCKTAKE_EXPORT_PAGE_SIZE,
    });
    const rows = await stocktakeLines(db, input.take.id, query);
    for (const row of rows.items)
      sheet.addRow(cells(input.take.warehouseName, publicLine(input.take, row), input.kind));
  }
}
export async function exportStocktake(db: Database, id: string, kind: 'blank' | 'result') {
  return db.readSnapshot(async (tx) => {
    const take = await getStocktake(tx, id);
    if (take.lineCount > WEB_EXPORT_MAX_ROWS) throw new AppError('EXPORT_TOO_LARGE', stocktakeCopy.exportTooLarge, 422);
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet(stocktakeCopy.exportSheet);
    sheet.addRow(columns(take));
    await appendRows(tx, sheet, { take, kind });
    return {
      filename: `${take.number}-${kind === 'blank' ? stocktakeCopy.exportBlank : stocktakeCopy.exportResult}.xlsx`,
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    };
  });
}
