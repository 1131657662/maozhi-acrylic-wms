import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { listCellText, listFields, matchedLineFields, webInboundListSchema, type ExportRequest } from '@wms/contracts';
import { exportFixture, waitExport, workbook } from './export-fixture.ts';
import { matchedRequest } from './b6b-export-test-helpers.ts';
import { actor } from './fixture.ts';

function xlsxCellText(cell: { value: unknown; text: string }, field: { type: string }): string {
  if (field.type === 'date' && cell.value instanceof Date)
    return cell.value.toISOString().slice(0, 19).replaceAll('-', '/').replace('T', ' ');
  if (field.type === 'tonnes' && typeof cell.value === 'number') return cell.value.toFixed(4);
  return cell.text;
}

test('B6b Step 4 matched_lines XLSX/CSV 与列表命中行逐字段一致且重放复用任务', async () => {
  const f = await exportFixture();
  try {
    const query = {
      keyword: 'WL-RK-',
      productCodes: 'WL-P000130',
      productMode: 'any',
      from: '2026-11-01T00:00:00+08:00',
      to: '2026-11-30T23:59:59.999+08:00',
      page: '1',
      pageSize: '50',
      sortBy: 'receiptNo',
      direction: 'asc',
    };
    const list = await f.api.get('/api/v1/web/lists/inbound').query(query).set('Cookie', f.cookie).expect(200);
    const page = list.body.data;
    assert.equal(page.matchedTotals.documentCount, 1);
    assert.equal(page.matchedTotals.lineCount, 2);
    assert.equal(page.matchedTotals.packages, 2);
    assert.equal(page.matchedTotals.weightGrams, 600000);
    const input = matchedRequest(page, 'xlsx');
    const job = await f.service.create(input, actor);
    const replay = await f.service.create(input, actor);
    assert.equal(replay.id, job.id);
    const end = await waitExport(f, job.id);
    assert.equal(end.state, 'ready', end.error ?? '');
    assert.equal(end.schema, 'matched_lines');
    assert.equal(end.total, 2);
    assert.equal(end.totals.packages, String(page.matchedTotals.packages));
    assert.equal(end.totals.weightGrams, (page.matchedTotals.weightGrams / 1_000_000).toFixed(4));
    const { sheet } = await workbook(f, job.id);
    assert.deepEqual((sheet.getRow(1).values as unknown[]).slice(1), [
      '入库单号',
      '商品编码',
      '商品名称',
      '包数',
      '重量（吨）',
    ]);
    const fields = matchedLineFields('inbound');
    const expectedRows: Record<string, unknown>[] = page.items.flatMap((item: Record<string, unknown>) => {
      const lines = Array.isArray(item.matchedLines) ? (item.matchedLines as Record<string, unknown>[]) : [];
      return lines.map((line) => ({ ...line, receiptNo: item.receiptNo }));
    });
    assert.equal(expectedRows.length, 2);
    expectedRows.forEach((row: Record<string, unknown>, index: number) => {
      assert.deepEqual(
        fields.map((field) => listCellText('inbound', field, row)),
        [1, 2, 3, 4, 5].map((column) => sheet.getCell(index + 2, column).text),
      );
    });
    const csvInput = matchedRequest(page, 'csv');
    await f.service.create(csvInput, actor);
    const csvJob = await waitExport(f, csvInput.requestId);
    const csvFile = await f.service.download(csvJob.id);
    const csv = await readFile(csvFile.path, 'utf8');
    assert.match(csv, /商品编码/);
    assert.match(csv, /WL-P000130/);
    console.log(
      `B6B_STEP4_MATCHED schema=matched_lines documents=${page.matchedTotals.documentCount} lines=${page.matchedTotals.lineCount} packages=${page.matchedTotals.packages} weightGrams=${page.matchedTotals.weightGrams} xlsxDifferences=0 csv=true replaySameTask=true`,
    );
  } finally {
    await f.dispose();
  }
});
test('B6b Step 4 单月单据汇总 XLSX 与列表逐字段、顺序和合计一致', async () => {
  const f = await exportFixture();
  try {
    const query = {
      keyword: 'WL-RK-',
      from: '2026-11-01T00:00:00+08:00',
      to: '2026-11-30T23:59:59.999+08:00',
      page: '1',
      pageSize: '200',
      sortBy: 'receiptNo',
      direction: 'asc',
    };
    const pages = [];
    for (const page of ['1', '2']) {
      const response = await f.api
        .get('/api/v1/web/lists/inbound')
        .query({ ...query, page })
        .set('Cookie', f.cookie)
        .expect(200);
      pages.push(webInboundListSchema.parse(response.body.data));
    }
    const fields = [
      'receiptNo',
      'packages',
      'weightGrams',
      'status',
      'postingState',
      'products',
      'supplierName',
      'warehouseName',
      'createdAt',
    ].map((key) => listFields.inbound.find((field) => field.key === key)!);
    const request: ExportRequest = {
      requestId: randomUUID(),
      kind: 'inbound',
      scope: 'all',
      schema: 'document_summary',
      format: 'xlsx',
      query,
      columns: fields.map((field) => field.key),
      viewToken: pages[0]!.viewToken,
      selected: [],
    };
    const job = await f.service.create(request, actor);
    const completed = await waitExport(f, job.id);
    assert.equal(completed.state, 'ready', completed.error ?? '');
    assert.equal(completed.total, 240);
    const { sheet } = await workbook(f, job.id);
    assert.deepEqual(
      (sheet.getRow(1).values as unknown[]).slice(1),
      fields.map((field) => field.label),
    );
    const rows = pages.flatMap((page) => page.items);
    rows.forEach((row, index) => {
      assert.deepEqual(
        fields.map((field) => listCellText('inbound', field, row)),
        fields.map((field, column) => xlsxCellText(sheet.getCell(index + 2, column + 1), field)),
      );
    });
    const expectedPackages = rows.reduce((sum, row) => sum + row.packages, 0);
    const expectedWeight = rows.reduce((sum, row) => sum + row.weightGrams, 0);
    assert.equal(completed.totals.packages, String(expectedPackages));
    assert.equal(completed.totals.weightGrams, (expectedWeight / 1_000_000).toFixed(4));
    console.log(
      `B6B_STEP4_MONTH schema=document_summary month=2026-11 documents=${rows.length} comparedCells=${rows.length * fields.length} differences=0 totalsDifferences=0 packages=${expectedPackages} weightGrams=${expectedWeight}`,
    );
  } finally {
    await f.dispose();
  }
});
