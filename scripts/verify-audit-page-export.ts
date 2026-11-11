import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { listFields, type ExportRequest } from '@wms/contracts';
import { numberingFixture, origin } from '../apps/api/tests/numbering-fixture.ts';
import { actor } from '../apps/api/tests/fixture.ts';
import { WebExports } from '../apps/api/src/features/web-exports/service.ts';
const root = path.resolve('.local/evidence/b6c-3-export-capacity');
const c = await numberingFixture();
const fields = listFields.audit;
const query = { keyword: '审计容量验收', sortBy: 'createdAt', direction: 'desc' };
const service = new WebExports(c.db, path.join(root, 'jobs'));
async function wait(service: WebExports, id: string) {
  const deadline = Date.now() + 360_000;
  while (await service.current()) {
    assert.ok(Date.now() < deadline, 'export deadline');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return service.get(id);
}
async function input(): Promise<ExportRequest> {
  const list = await c.web.get('/api/v1/web/lists/audit').query(query).expect(200);
  return {
    kind: 'audit',
    format: 'xlsx',
    requestId: randomUUID(),
    query,
    scope: 'all',
    selected: [],
    columns: fields.map((field) => field.key),
    viewToken: list.body.data.viewToken,
  };
}
async function seed(count: number) {
  for (let offset = 0; offset < count; offset += 1000) {
    const values = Array.from({ length: Math.min(1000, count - offset) }, (_, i) => [
      `容量-${String(offset + i).padStart(6, '0')}`,
      `对象-${offset + i}`,
      '审计容量验收',
      randomUUID(),
    ]).flat();
    await c.db.run(
      `INSERT INTO operation_log(action,target_kind,target_no,target_id,actor,trace_id,created_at,
      channel,result,effect_state,summary,before_json,after_json)
      VALUES ${Array.from({ length: values.length / 4 }, () => "('inbound.confirm','inbound',?,?,?, ?,UTC_TIMESTAMP(3),'web','success','applied','状态 待确认→已入账','{}','{}')").join(',')}`,
      values,
    );
  }
}
async function failAndCancel(request: ExportRequest) {
  const results = [];
  for (const mode of ['failure', 'cancel'] as const) {
    const dir = path.join(root, mode);
    const current = new WebExports(c.db, dir, {
      afterBatch: async () => {
        if (mode === 'failure') throw new Error('injected writer interruption');
        const job = await current.current();
        assert.ok(job);
        await current.cancel(job.id);
      },
    });
    const job = await current.create({ ...request, requestId: randomUUID() }, actor);
    const end = await wait(current, job.id);
    assert.equal(end.state, mode === 'failure' ? 'failed' : 'cancelled');
    await assert.rejects(current.download(job.id), { status: 409 });
    const files = await readdir(dir);
    assert.equal(
      files.some((file) => /\.(xlsx|part)$/.test(file)),
      false,
    );
    results.push({ mode, status: end.state, download: 409, partialFile: false });
  }
  return results;
}
try {
  await mkdir(root, { recursive: true });
  await seed(100000);
  const request = await input(),
    start = performance.now();
  const job = await service.create(request, actor),
    end = await wait(service, job.id);
  assert.equal(end.state, 'ready', end.error ?? '');
  assert.equal(end.processed, 100000);
  const durationMs = Math.round(performance.now() - start);
  const file = await service.download(job.id),
    book = new ExcelJS.Workbook();
  assert.ok(existsSync(file.path));
  await book.xlsx.readFile(file.path);
  const sheet = book.worksheets[0]!;
  assert.equal(sheet.rowCount, 100002);
  const labels = Array.from({ length: 100000 }, (_, i) => String(sheet.getCell(i + 2, 3).value));
  assert.equal(new Set(labels).size, 100000);
  const lastPage = await c.web
    .get('/api/v1/web/lists/audit')
    .query({ ...query, page: '5000', pageSize: '20' })
    .expect(200);
  assert.equal(labels.at(-1), lastPage.body.data.items.at(-1).objectLabel);
  await c.db.run(
    `INSERT INTO operation_log(action,target_id,actor,trace_id,created_at,before_json,after_json)
    VALUES('inbound.confirm','excess','审计容量验收',?,UTC_TIMESTAMP(3),'{}','{}')`,
    [randomUUID()],
  );
  const excess = await c.web
    .post('/api/v1/web/exports')
    .set('Origin', origin)
    .send(await input())
    .expect(422);
  assert.match(excess.body.message, /100,001/);
  const stale = await c.web
    .post('/api/v1/web/exports')
    .set('Origin', origin)
    .send({ ...request, requestId: randomUUID() })
    .expect(409);
  const small = { ...(await input()), scope: 'page' as const };
  const failures = await failAndCancel(small);
  const output = {
    rows: end.processed,
    durationMs,
    last: labels.at(-1),
    lastMatches: true,
    duplicates: 0,
    excess: { actual: 100001, status: excess.status },
    stale: stale.status,
    failures,
  };
  await writeFile(path.join(root, 'result.json'), JSON.stringify(output, null, 2));
  console.log('B6C3_CAPACITY', JSON.stringify(output));
} finally {
  await c.dispose();
}
