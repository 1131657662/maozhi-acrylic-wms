import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { actor, fact, fixture } from './fixture.ts';
import { recordFact } from '../src/features/scan/service.ts';
import { exportScanRecords } from '../src/features/outbound/scan-export.ts';

test('B4d scan XLSX preserves barcode text and per-row values with totals', async () => {
  const c = await fixture();
  try {
    await recordFact(c.db, { planId: 'DEMO-001', fact: fact(), actor });
    await recordFact(c.db, { planId: 'DEMO-001', fact: fact({ barcode: 'DEMO-032-12', weightGrams: 297500 }), actor });
    const exported = await exportScanRecords(c.db, 'DEMO-001');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Uint8Array.from(exported.buffer).buffer);
    const sheet = book.worksheets[0]!;
    assert.equal(sheet.rowCount, 4);
    assert.deepEqual(Array.from(sheet.getRow(2).values as ExcelJS.CellValue[]).slice(1, 7), [
      'DEMO-032-11',
      '腈纶原料 · 合成样本',
      'ACR-032',
      1,
      302.5,
      0.3025,
    ]);
    assert.deepEqual(Array.from(sheet.getRow(4).values as ExcelJS.CellValue[]).slice(4, 7), [2, 600, 0.6]);
    console.log('B4D_XLSX rows=2 packages=2 kg=600 tonnes=0.6000 fields_equal=true');
  } finally {
    await c.dispose();
  }
});
