import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { listFields, listCellText, type ExportRequest, type ReportKind } from '@wms/contracts';
import { reportFixture, reportParams } from './report-fixture.ts';
import { waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';

test('B3b: both XLSX reports match every field in all/page/selected scopes and never sum balances', async () => {
  const f = await reportFixture();
  try {
    for (const kind of ['report-details', 'report-monthly'] as ReportKind[]) {
      const path = '/api/v1/web/reports/' + kind.slice(7),
        query = { ...reportParams, pageSize: '20', page: kind === 'report-details' ? '2' : '1' };
      const current = (await f.api.get(path).query(query).set('Cookie', f.cookie).expect(200)).body.data;
      const all = (
        await f.api
          .get(path)
          .query({ ...query, page: '1', pageSize: '200' })
          .set('Cookie', f.cookie)
          .expect(200)
      ).body.data;
      for (const scope of ['all', 'page', 'selected'] as const) {
        const input: ExportRequest = {
          requestId: randomUUID(),
          kind,
          scope,
          query,
          columns: listFields[kind].map((f) => f.key),
          viewToken: current.viewToken,
          selected:
            scope === 'selected' ? [{ id: current.items[0].id, token: current.rowTokens[current.items[0].id] }] : [],
        };
        const job = await f.service.create(input, actor),
          ready = await waitExport(f, job.id);
        assert.equal(ready.state, 'ready', ready.error ?? '');
        const { sheet, book } = await workbook(f, job.id);
        const expected: Record<string, unknown>[] =
          scope === 'all' ? all.items : scope === 'page' ? current.items : [current.items[0]];
        assert.equal(sheet.rowCount, expected.length + 2);
        for (let r = 0; r < expected.length; r++)
          for (let c = 0; c < input.columns.length; c++) {
            const field = listFields[kind][c]!,
              cell = sheet.getCell(r + 2, c + 1),
              value = cell.value;
            const actual =
              value instanceof Date
                ? value.toISOString().slice(0, 19).replaceAll('-', '/').replace('T', ' ')
                : field.type === 'tonnes' && typeof value === 'number'
                  ? value.toFixed(4)
                  : cell.text;
            assert.equal(actual, listCellText(kind, field, expected[r]!), `${kind}/${scope}/${r}/${field.key}`);
            if (field.total === false) assert.equal(ready.totals[field.key], undefined);
          }
        const balance = book.getWorksheet('收发存对账')!;
        assert.equal(balance.getCell(3, 2).value, all.report.reconciliation.openingPackages);
        assert.equal(balance.getCell(7, 3).value, all.report.reconciliation.closingGrams / 1_000_000);
        console.log(
          'B3B_XLSX',
          JSON.stringify({
            kind,
            scope,
            rows: expected.length,
            fields: input.columns.length,
            comparedCells: expected.length * input.columns.length,
            differences: 0,
            last: expected.at(-1)?.id,
          }),
        );
      }
    }
    const query = { ...reportParams, movement: 'inbound' };
    const filtered = (await f.api.get('/api/v1/web/reports/details').query(query).set('Cookie', f.cookie).expect(200))
      .body.data;
    const job = await f.service.create(
      {
        requestId: randomUUID(),
        kind: 'report-details',
        scope: 'all',
        query,
        columns: listFields['report-details'].map((field) => field.key),
        viewToken: filtered.viewToken,
        selected: [],
      },
      actor,
    );
    assert.equal((await waitExport(f, job.id)).state, 'ready');
    const { sheet } = await workbook(f, job.id);
    assert.equal(sheet.rowCount, 26);
    const directionColumn = listFields['report-details'].findIndex((field) => field.key === 'directionLabel') + 1;
    for (let row = 2; row <= 25; row++) assert.equal(sheet.getCell(row, directionColumn).value, '入库');
    console.log('B3B_DIRECTION_EXPORT direction=inbound rows=24 mismatches=0 reconciliation=full-range');
  } finally {
    await f.dispose();
  }
});

test('B3b: missing balances stay text in XLSX, and stale snapshot rejects before publishing', async () => {
  const f = await reportFixture();
  try {
    const query = { ...reportParams, fromDay: '2025-12-01', toDay: '2025-12-31' };
    const current = (await f.api.get('/api/v1/web/reports/monthly').query(query).set('Cookie', f.cookie).expect(200))
      .body.data;
    const input: ExportRequest = {
      requestId: randomUUID(),
      kind: 'report-monthly',
      scope: 'all',
      query,
      columns: ['period', 'openingPackages', 'openingGrams', 'differenceGrams'],
      viewToken: current.viewToken,
      selected: [],
    };
    const first = await f.service.create(input, actor);
    assert.equal((await waitExport(f, first.id)).state, 'ready');
    const { sheet, book } = await workbook(f, first.id);
    assert.equal(sheet.getCell(2, 2).value, '-');
    assert.equal(sheet.getCell(2, 4).value, '-');
    assert.equal(book.getWorksheet('收发存对账')!.getCell(3, 2).value, '—（不可验证）');
    await f.db.run("UPDATE stock SET packages=packages+1 WHERE warehouse_code='RPT-W1' AND product_code='RPT-P1'");
    const job = await f.service.create({ ...input, requestId: randomUUID() }, actor),
      result = await waitExport(f, job.id);
    assert.equal(result.errorCode, 'EXPORT_VIEW_CHANGED');
    await assert.rejects(() => f.service.download(job.id));
    console.log('B3B_EXPORT_GUARD missing=null/text stale=EXPORT_VIEW_CHANGED file=none');
  } finally {
    await f.dispose();
  }
});
