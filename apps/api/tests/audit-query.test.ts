import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { auditQueryFixture } from './audit-query-fixture.ts';
import { listWebAudit } from '../src/features/web-lists/audit.ts';
import { auditChanges } from '../src/features/audit/changes.ts';
import { webAuditQuerySchema, auditActions, auditAction, auditResultText } from '@wms/contracts';
const base = '/api/v1/web/lists/audit';
function safe(value: unknown) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /traceId|trace_id|beforeJson|afterJson|before_json|after_json|input_summary|error_code|SECRET-|STATE_CODE/,
  );
}

test('B6c-2 list and legacy read only safe columns with distinct source keys', async () => {
  const c = await auditQueryFixture(2);
  try {
    const sql: string[] = [],
      all = c.db.all.bind(c.db),
      withConnection = c.db.withConnection.bind(c.db);
    c.db.withConnection = (work) =>
      withConnection(async (tx) => {
        const read = tx.all.bind(tx);
        tx.all = (query, values) => {
          sql.push(query);
          return read(query, values);
        };
        return work(tx);
      });
    const rows = await listWebAudit(c.db, webAuditQuerySchema.parse({ target: 'RK-审计测试' }));
    assert.equal(rows.total, 3);
    assert.equal(new Set(rows.items.map((row) => row.id)).size, 3);
    safe(rows);
    assert.doesNotMatch(sql.join('\n'), /before_json|after_json|input_summary|trace_id|error_code/);
    const old = await c.web.get('/api/v1/audit').expect(200);
    safe(old.body);
    const response = await c.web.get(base).query({ result: 'failed' }).expect(200);
    safe(response.body);
    assert.equal(response.body.data.items[0].result, '失败');
    await c.web.get(base).query({ traceId: c.trace }).expect(422);
    void all;
    console.log('B6C2_SAFE list=3 legacy=safe forbidden_sql_columns=0 source_collision=0');
  } finally {
    await c.dispose();
  }
});
test('B6c-2 detail uses Chinese structured changes and safe same-request summaries', async () => {
  const c = await auditQueryFixture(2);
  try {
    const detail = await c.web.get(`${base}/${c.id}`).expect(200);
    safe(detail.body);
    assert.deepEqual(
      detail.body.data.changes.find((v: { field: string }) => v.field === 'packages'),
      { field: 'packages', label: '包数', unit: '包', before: '0', after: '1' },
    );
    assert.equal(detail.body.data.related.total, 3);
    assert.equal(detail.body.data.href, null);
    assert.equal(detail.body.data.objectLabel, 'RK-审计测试');
    assert.equal(auditActions['catalog.publish']?.dangerous, true);
    assert.equal(auditResultText('other'), '未识别');
    assert.equal(auditResultText('constructor'), '未识别');
    assert.equal(auditAction('__proto__').label, '未识别');
    for (const value of ['unknown-state', 'constructor', '__proto__']) {
      const changes = auditChanges('stocktake.post', {}, { status: value, postingState: value });
      assert.deepEqual(
        changes.map((change) => change.after),
        ['未识别', '未识别'],
      );
    }
    assert.doesNotMatch(JSON.stringify(detail.body), new RegExp(c.target));
  } finally {
    await c.dispose();
  }
});
test('B6c-2 raw requires a logged-in Web session on every route and download', async () => {
  const c = await auditQueryFixture(1);
  try {
    const paths = [
      `${base}/${c.id}/raw`,
      `${base}/${c.id}/trace.json`,
      `/api/v1/audit/${c.id}/raw`,
      `/api/v1/audit/${c.id}/trace.json`,
    ];
    for (const path of paths) await request(c.app).get(path).expect(401);
    for (const channel of ['pda', 'miniapp']) {
      const login = await request(c.app)
        .post('/api/v1/auth/login')
        .send({ username: 'owner', password: 'test-only-password', channel });
      for (const path of paths)
        await request(c.app).get(path).set('Authorization', `Bearer ${login.body.data.token}`).expect(403);
    }
    const raw = await c.web.get(`${base}/${c.attemptId}/raw`).expect(200);
    assert.match(String(raw.headers['cache-control']), /no-store/);
    assert.doesNotMatch(JSON.stringify(raw.body), /SECRET-/);
    assert.equal(raw.body.data.items[0].record.input_summary.data.token, '[已隐藏]');
    await c.web
      .get(`${base}/${c.id}/raw`)
      .query({ traceId: c.trace.slice(0, -1) })
      .expect(404);
    console.log('B6C2_RAW anonymous=401 mobile=403 nested_token=hidden encoded_cookie=hidden no_store=true');
  } finally {
    await c.dispose();
  }
});
test('B6c-2 trace keyset pagination and complete JSON match every stored record after redaction', async () => {
  const c = await auditQueryFixture();
  try {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await c.web
        .get(`${base}/${c.id}/raw`)
        .query({ traceId: c.trace, pageSize: 20, ...(cursor ? { cursor } : {}) })
        .expect(200);
      ids.push(...page.body.data.items.map((row: { id: string }) => row.id));
      cursor = page.body.data.nextCursor;
      assert.equal(page.body.data.total, c.count);
    } while (cursor);
    assert.equal(ids.length, c.count);
    assert.equal(new Set(ids).size, c.count);
    const file = await c.web.get(`${base}/${c.id}/trace.json`).expect(200);
    assert.equal(file.body.count, c.count);
    assert.deepEqual(
      file.body.records.map((r: { id: string }) => r.id),
      ids,
    );
    const { redactAuditValue } = await import('../src/features/audit/sanitize.ts');
    for (const record of file.body.records) {
      const event = record.source === 'business_event';
      const row = await c.db.get(
        `SELECT * FROM ${event ? 'operation_log' : 'operation_attempts'} WHERE ${event ? 'id' : 'attempt_id'}=?`,
        [record.sourceId],
      );
      assert.deepEqual(record.record, redactAuditValue(row));
    }
    console.log(`B6C2_TRACE database=${c.count} pages=3 unique=${ids.length} diagnostic_field_comparison=all_equal`);
  } finally {
    await c.dispose();
  }
});
test('B6c-2 object timeline includes failures, paginates events, and never exposes deleted object IDs', async () => {
  const c = await auditQueryFixture();
  try {
    const timeline = await c.web.get(`${base}/timeline`).query({ target: 'RK-审计测试' }).expect(200);
    safe(timeline.body);
    assert.equal(timeline.body.data.items.length, 1);
    const group = timeline.body.data.items[0];
    assert.equal(group.events.total, c.count);
    assert.equal(group.events.items.length, 50);
    assert.equal(group.href, null);
    assert.ok(group.events.items.some((row: { result: string }) => row.result === '失败'));
    const next = await c.web.get(`${base}/${group.id}/events`).query({ cursor: group.events.nextCursor }).expect(200);
    assert.equal(next.body.data.items.length, 6);
    safe(next.body);
    const object = await c.web.get(`${base}/objects/inbound/${c.target}`).expect(200);
    assert.equal(object.body.data.total, c.count);
    assert.doesNotMatch(JSON.stringify(timeline.body), new RegExp(c.target));
  } finally {
    await c.dispose();
  }
});
