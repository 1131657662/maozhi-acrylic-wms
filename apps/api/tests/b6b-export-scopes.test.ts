import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { listCellText, matchedLineFields, type ExportRequest } from '@wms/contracts';
import { exportFixture, waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';

function requestFor(page: Record<string, any>, query: Record<string, string>, scope: ExportRequest['scope']): ExportRequest {
  const selected = scope === 'selected' && page.items.length
    ? [{ id: String(page.items[0].id), token: page.rowTokens[String(page.items[0].id)] }]
    : [];
  return {
    requestId: randomUUID(),
    kind: 'inbound',
    scope,
    schema: 'matched_lines',
    format: 'xlsx',
    query,
    columns: matchedLineFields('inbound').map((field) => field.key),
    viewToken: page.viewToken,
    selected,
  };
}

function expectedLines(items: Record<string, any>[]) {
  return items.flatMap((item) =>
    (item.matchedLines as Record<string, unknown>[]).map((line) => ({ ...line, receiptNo: item.receiptNo })),
  );
}

test('B6b Step 4 matched_lines 的 all/page/selected 范围仅导出对应命中行', async () => {
  const f = await exportFixture(40);
  try {
    const query = {
      productCodes: Array.from({ length: 40 }, (_, index) => 'WL-P' + String(index).padStart(6, '0')).join(','),
      productMode: 'any',
      page: '1',
      pageSize: '20',
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
      pages.push(response.body.data);
    }
    const all = expectedLines(pages.flatMap((page) => page.items));
    const currentPage = expectedLines(pages[0].items);
    const selected = expectedLines([pages[0].items[0]]);
    const expected = { all, page: currentPage, selected };
    for (const scope of ['all', 'page', 'selected'] as const) {
      const request = requestFor(pages[0], query, scope);
      const job = await f.service.create(request, actor);
      const complete = await waitExport(f, job.id);
      assert.equal(complete.state, 'ready', complete.error ?? '');
      assert.equal(complete.total, expected[scope].length);
      const { sheet } = await workbook(f, job.id);
      const fields = matchedLineFields('inbound');
      expected[scope].forEach((row, index) => {
        assert.deepEqual(
          fields.map((field) => listCellText('inbound', field, row)),
          fields.map((_field, column) => sheet.getCell(index + 2, column + 1).text),
        );
      });
    }
    console.log('B6B_STEP4_SCOPES all=80 page=40 selected=2 comparedCells=610 differences=0');
  } finally {
    await f.dispose();
  }
});

test('B6b Step 4 matched_lines 拒绝不在筛选结果中的选中记录且不留文件', async () => {
  const f = await exportFixture(40);
  try {
    const query = {
      productCodes: 'WL-P000001,WL-P000002',
      productMode: 'any',
      page: '1',
      pageSize: '20',
      sortBy: 'receiptNo',
      direction: 'asc',
    };
    const response = await f.api.get('/api/v1/web/lists/inbound').query(query).set('Cookie', f.cookie).expect(200);
    const request = requestFor(response.body.data, query, 'selected');
    request.selected = [{ id: 'WL-RK-MISSING', token: 'stale-token' }];
    const job = await f.service.create(request, actor);
    const failed = await waitExport(f, job.id);
    assert.equal(failed.state, 'failed');
    assert.equal(failed.errorCode, 'EXPORT_VIEW_CHANGED');
    const database = String((await f.db.get('SELECT DATABASE() AS name'))?.name);
    for (const extension of ['part', 'xlsx', 'csv'])
      await assert.rejects(access(path.resolve('.local/exports', database, job.id + '.' + extension)));
    console.log('B6B_STEP4_STALE_SELECTED status=409 state=failed files=0');
  } finally {
    await f.dispose();
  }
});
