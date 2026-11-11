import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { listTime, listCellText, listFields } from '@wms/contracts';
import { ApiError } from '../../web/src/api/errors.ts';
import { XlsxWriter } from '../src/features/web-exports/writer.ts';

const iso = '2026-11-11T06:37:30Z',
  display = '2026-11-11 14:37:30';
test('Shanghai date display and error diagnostics use hyphenated year-month-day', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(iso) });
  assert.equal(listTime(iso), display);
  assert.equal(new ApiError('', 500, '').time, display);
  assert.equal(listTime('2026-11-10T16:00:00Z'), '2026-11-11 00:00:00');
});

test('XLSX date type, local wall time and hyphenated format match screen field', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wms-date-'));
  try {
    const field = listFields.outbound.find((f) => f.key === 'createdAt')!;
    const filename = join(directory, 'dates.xlsx');
    const writer = new XlsxWriter({ filename, kind: 'outbound', fields: [field] });
    assert.deepEqual(writer.append({ createdAt: iso }), [display]);
    await writer.finish(1);
    const book = await new ExcelJS.Workbook().xlsx.readFile(filename);
    const cell = book.worksheets[0]!.getCell(2, 1);
    assert.ok(cell.value instanceof Date);
    assert.equal(cell.numFmt, 'yyyy-mm-dd hh:mm:ss');
    assert.equal(
      cell.value.toISOString().slice(0, 19).replace('T', ' '),
      listCellText('outbound', field, { createdAt: iso }),
    );
    console.log(`B4D_DATE iso=${iso} screen=${display} xlsx=${display} type=date`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
