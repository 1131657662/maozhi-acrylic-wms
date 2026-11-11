import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIT_RAW_PREVIEW_BYTES, AUDIT_DIAGNOSTIC_BYTES, AUDIT_MAX_RECORDS } from '@wms/contracts';
import { auditQueryFixture } from './audit-query-fixture.ts';
import { traceDiagnostic } from '../src/features/audit/raw.ts';

test('B6c-2 oversized preview refuses without truncation and diagnostic still contains the complete value', async () => {
  const c = await auditQueryFixture(1);
  try {
    const value = '业务资料'.repeat(AUDIT_RAW_PREVIEW_BYTES / 4);
    await c.db.run('UPDATE operation_log SET after_json=? WHERE id=?', [
      JSON.stringify({ memo: value }),
      c.id.slice(6),
    ]);
    const preview = await c.web.get(`/api/v1/audit/${c.id}/raw`).expect(422);
    assert.equal(preview.body.code, 'AUDIT_SIZE_LIMIT');
    assert.equal(preview.body.data, null);
    const file = await c.web.get(`/api/v1/audit/${c.id}/trace.json`).expect(200);
    const event = file.body.records.find((row: { id: string }) => row.id === c.id);
    assert.equal(JSON.parse(event.record.after_json).memo, value);
    console.log(`B6C2_PREVIEW status=422 limit=${AUDIT_RAW_PREVIEW_BYTES} truncated=false diagnostic_value=complete`);
  } finally {
    await c.dispose();
  }
});

test('B6c-2 diagnostic byte and count preflight reject before transferring raw data', async () => {
  const c = await auditQueryFixture(1);
  try {
    const connection = c.db.withConnection.bind(c.db);
    let mode = 'bytes',
      rawReads = 0;
    c.db.withConnection = (work) =>
      connection(async (tx) => {
        const all = tx.all.bind(tx);
        tx.all = (sql, values) => {
          if (mode === 'bytes' && sql.includes(' AS payload_bytes'))
            return Promise.resolve([{ payload_bytes: AUDIT_DIAGNOSTIC_BYTES + 1 }]);
          if (mode === 'count' && sql.startsWith('SELECT COUNT(*) AS n'))
            return Promise.resolve([{ n: AUDIT_MAX_RECORDS + 1 }]);
          if (/SELECT \* FROM operation_/.test(sql)) rawReads++;
          return all(sql, values);
        };
        return work(tx);
      });
    for (mode of ['bytes', 'count']) {
      const response = await c.web.get(`/api/v1/audit/${c.id}/trace.json`).expect(422);
      assert.equal(response.headers['content-disposition'], undefined);
      assert.equal(response.body.records, undefined);
    }
    assert.equal(rawReads, 0);
    console.log(
      `B6C2_LIMITS bytes=${AUDIT_DIAGNOSTIC_BYTES} records=${AUDIT_MAX_RECORDS} excess=422 raw_reads=0 partial_download=false`,
    );
  } finally {
    await c.dispose();
  }
});

test('B6c-2 failure or cancellation during diagnostic generation never returns a partial artifact', async () => {
  const c = await auditQueryFixture();
  try {
    let pages = 0;
    await assert.rejects(
      traceDiagnostic(c.db, c.id, undefined, {
        afterPage: () => {
          pages++;
          throw new Error('injected interruption');
        },
      }),
      /injected interruption/,
    );
    assert.equal(pages, 1);
    const abort = new AbortController();
    await assert.rejects(traceDiagnostic(c.db, c.id, abort.signal, { afterPage: () => abort.abort() }), {
      name: 'AbortError',
    });
    const connection = c.db.withConnection.bind(c.db);
    c.db.withConnection = (work) =>
      connection(async (tx) => {
        const all = tx.all.bind(tx);
        tx.all = (sql, values) =>
          /SELECT \* FROM operation_/.test(sql)
            ? Promise.reject(new Error('injected read interruption'))
            : all(sql, values);
        return work(tx);
      });
    const response = await c.web.get(`/api/v1/audit/${c.id}/trace.json`).expect(500);
    assert.equal(response.headers['content-disposition'], undefined);
    assert.equal(response.body.records, undefined);
    console.log('B6C2_ATOMIC generation_failure=500 cancelled=AbortError completed_file=0 attachment=absent');
  } finally {
    await c.dispose();
  }
});
