import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { listFields } from '@wms/contracts';
import { auditQueryFixture } from './audit-query-fixture.ts';
import { webExports } from '../src/features/web-exports/service.ts';
import { actor } from './fixture.ts';

test('B6c-2 ordinary XLSX matches every safe list field including failed attempts', async () => {
  const c = await auditQueryFixture(2);
  try {
    const query = { target: 'RK-审计测试' };
    const list = (await c.web.get('/api/v1/web/lists/audit').query(query).expect(200)).body.data;
    const service = await webExports(c.db),
      fields = listFields.audit;
    const job = await service.create(
      {
        kind: 'audit',
        requestId: randomUUID(),
        query,
        scope: 'all',
        selected: [],
        columns: fields.map((field) => field.key),
        viewToken: list.viewToken,
      },
      actor,
    );
    while (await service.current()) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal((await service.get(job.id)).state, 'ready');
    const file = await service.download(job.id),
      book = new ExcelJS.Workbook();
    await book.xlsx.readFile(file.path);
    const sheet = book.worksheets[0]!;
    assert.equal(sheet.rowCount, list.items.length + 2);
    for (const [rowIndex, row] of list.items.entries())
      for (const [columnIndex, field] of fields.entries()) {
        const cell = sheet.getCell(rowIndex + 2, columnIndex + 1).value;
        const expected = field.type === 'date' ? new Date(Date.parse(row[field.key]) + 8 * 3600_000) : row[field.key];
        assert.deepEqual(cell, expected, `row ${rowIndex} ${field.key}`);
      }
    assert.doesNotMatch(
      JSON.stringify(sheet.getSheetValues()),
      /trace|raw|SECRET-|STATE_CODE|error_code|before_json|after_json/,
    );
    console.log(
      `B6C2_EXPORT rows=${list.items.length} fields=${fields.length} compared_cells=${list.items.length * fields.length} failures=1 mismatches=0`,
    );
  } finally {
    await c.dispose();
  }
});
