import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { exportFixture, exportInput, waitExport, workbook, evidence } from './export-fixture.ts';
import { actor } from './fixture.ts';
import type { WebListKind } from '@wms/contracts';

for (const kind of ['inbound', 'outbound', 'stock', 'audit'] as WebListKind[]) {
  test(`B1b2 ${kind}: all/page/selected export exact records and typed cells`, async () => {
    const f = await exportFixture();
    try {
      for (const scope of ['all', 'page', 'selected'] as const) {
        const { input, page } = await exportInput(f, kind, scope);
        if (scope === 'selected')
          input.selected = [page.items[0], page.items[3]].map((row) => ({
            id: String(row.id),
            token: page.rowTokens[String(row.id)],
          }));
        const result = await f.api
          .post('/api/v1/web/exports')
          .set('Cookie', f.cookie)
          .set('Origin', 'http://localhost:5173')
          .send(input)
          .expect(202);
        const job = await waitExport(f, result.body.data.id);
        assert.equal(job.state, 'ready', job.error ?? '');
        const { sheet } = await workbook(f, job.id);
        const count = scope === 'all' ? 240 : scope === 'page' ? 20 : 2;
        assert.equal(job.total, count);
        assert.equal(sheet.rowCount, count + 2);
        assert.deepEqual(
          (sheet.getRow(1).values as unknown[]).slice(1),
          job.columns.map((c) => c.label),
        );
        const first = scope === 'all' ? '000000' : '000020';
        const idColumn = kind === 'stock' || kind === 'audit' ? 2 : 1;
        if (kind === 'audit') {
          assert.equal(sheet.getCell(2, idColumn).value, '未记录');
          assert.equal(sheet.getCell(2, 4).value, '未识别');
          assert.equal(sheet.getCell(2, 3).value, 'owner');
          assert.equal(
            job.columns.some((column) => column.key === 'traceId'),
            false,
          );
          assert.equal(JSON.stringify(sheet.getSheetValues()).includes('WL-TRACE-'), false);
        } else assert.match(String(sheet.getCell(2, idColumn).value), new RegExp(first + '$'));
        if (kind === 'inbound' || kind === 'outbound') {
          const i = input.columns.indexOf('createdAt') + 1;
          assert.ok(sheet.getCell(2, i).value instanceof Date);
          assert.equal(sheet.getColumn(i).numFmt, 'yyyy/mm/dd hh:mm:ss');
        }
        if (kind !== 'audit') {
          const key = kind === 'outbound' ? 'plannedWeightGrams' : 'weightGrams';
          const i = input.columns.indexOf(key) + 1;
          assert.equal(sheet.getCell(2, i).value, 0.6);
          assert.equal(sheet.getColumn(i).numFmt, '0.0000');
          assert.equal(Number(job.totals[key]), count * 0.6);
        }
        await evidence('B1B2_SCOPE', {
          kind,
          scope,
          rows: count,
          last: String(sheet.getCell(count + 1, idColumn).value),
          totals: job.totals,
          sha256: job.sha256,
        });
      }
    } finally {
      await f.dispose();
    }
  });
}
test('B1b2 stale selected rows reject, unauthorized channels cannot export', async () => {
  const f = await exportFixture();
  try {
    const { input, page } = await exportInput(f, 'stock', 'selected');
    input.selected = [{ id: page.items[0].id, token: page.rowTokens[page.items[0].id] }];
    await f.db.run("UPDATE stock SET packages=3 WHERE product_code='WL-P000020'");
    const fresh = await f.api.get('/api/v1/web/lists/stock').query(input.query).set('Cookie', f.cookie);
    input.viewToken = fresh.body.data.viewToken;
    const job = await f.service.create(input, actor);
    const end = await waitExport(f, job.id);
    assert.equal(end.errorCode, 'EXPORT_VIEW_CHANGED');
    await assert.rejects(f.service.download(job.id));
    await f.api.post('/api/v1/web/exports').send(input).expect(401);
    for (const channel of ['pda', 'miniapp']) {
      const login = await f.api
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel });
      await f.api
        .post('/api/v1/web/exports')
        .set('Authorization', `Bearer ${login.body.data.token}`)
        .send({ ...input, requestId: randomUUID() })
        .expect(403);
    }
    await evidence('B1B2_STALE', { code: end.errorCode, partialDownload: false, anonymous: 401, mobile: 403 });
  } finally {
    await f.dispose();
  }
});
