import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newReceipt, origin } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { inventorySnapshot, failAfter } from './inventory-fixture.ts';
import { auditEvidenceMetrics, recordFailedAttempt } from '../src/features/audit/attempts.ts';
import { newAttempt } from '../src/features/audit/context.ts';
import { logger } from '../src/shared/logger.ts';
import { audit } from '../src/shared/audit.ts';

test('B6c-1 failure after inventory and successful audit writes rolls everything back but retains attempt', async () => {
  const c = await numberingFixture();
  try {
    const receipt = await createInbound(c.db, newReceipt(), randomUUID(), actor);
    const before = await inventorySnapshot(c.db);
    await failAfter(c.db, 'idempotent_commands', 'INSERT');
    const response = await c.web
      .post(`/api/v1/inbound/${receipt.id}/confirm`)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(500);
    await c.db.run('DROP TRIGGER b1a_fail');
    assert.deepEqual(await inventorySnapshot(c.db), before);
    const rows = await c.db.all('SELECT * FROM operation_attempts WHERE trace_id=?', [response.body.traceId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.result, 'failed');
    assert.equal(rows[0]?.effect_state, 'not_applied');
    assert.equal(rows[0]?.target_id, receipt.id);
    assert.equal(rows[0]?.target_no, receipt.receiptNo);
    assert.equal(rows[0]?.channel, 'web');
    console.log(
      'B6C1_ROLLBACK',
      JSON.stringify({
        businessUnchanged: true,
        stockUnchanged: true,
        journalUnchanged: true,
        successAuditUnchanged: true,
        attempts: rows.length,
        result: rows[0]?.result,
        effect: rows[0]?.effect_state,
      }),
    );
  } finally {
    await c.dispose();
  }
});

test('B6c-1 concurrent ten identical command keys create one operation and one successful event', async () => {
  const c = await numberingFixture();
  try {
    const receipt = await createInbound(c.db, newReceipt(), randomUUID(), actor),
      key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        c.web
          .post(`/api/v1/inbound/${receipt.id}/confirm`)
          .set('Origin', origin)
          .set('Idempotency-Key', key)
          .send({})
          .expect(200),
      ),
    );
    const events = await c.db.all(
      "SELECT attempt_id,result,channel FROM operation_log WHERE action='inbound.confirm' AND target_id=?",
      [receipt.id],
    );
    const operations = await c.db.all('SELECT id FROM inventory_operations WHERE target_id=?', [receipt.id]);
    assert.equal(events.length, 1);
    assert.equal(operations.length, 1);
    assert.equal(events[0]?.result, 'success');
    assert.equal(events[0]?.channel, 'web');
    assert.equal((await c.db.all('SELECT * FROM operation_attempts')).length, 0);
    assert.equal(new Set(results.map((r) => r.body.data.confirmationOperationId)).size, 1);
    console.log('B6C1_CONCURRENCY requests=10 businessResults=1 successEvents=1 failedAttempts=0');
  } finally {
    await c.dispose();
  }
});

test('B6c-1 evidence write failure emits safe log and observable count without claiming persistence', async () => {
  const c = await numberingFixture();
  const log: unknown[] = [];
  const original = logger.error;
  try {
    await c.db.run(`CREATE TRIGGER fail_attempt BEFORE INSERT ON operation_attempts FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='password=DO_NOT_LOG_THIS'`);
    logger.error = ((...args: unknown[]) => {
      log.push(args);
    }) as typeof logger.error;
    const response = await c.web
      .post('/api/v1/inbound')
      .set('Origin', origin)
      .send({ password: 'DO_NOT_LOG_THIS' })
      .expect(422);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.equal(auditEvidenceMetrics(c.db).writeFailures, 1);
    assert.equal((await c.db.all('SELECT * FROM operation_attempts')).length, 0);
    assert.match(JSON.stringify(log), /audit_attempt_write_failures_total/);
    assert.match(JSON.stringify(log), /"saved":false/);
    assert.doesNotMatch(JSON.stringify(log), /DO_NOT_LOG_THIS|password/);
    console.log('B6C1_WRITE_FAILURE', JSON.stringify({ metrics: auditEvidenceMetrics(c.db), rows: 0, log }));
  } finally {
    logger.error = original;
    await c.dispose();
  }
});

test('B6c-1 repeated persistence of one attempt is immutable and deduplicated', async () => {
  const c = await numberingFixture();
  try {
    const context = newAttempt(
      { action: 'inbound.confirm', targetKind: 'inbound', targetId: null, channel: 'web' },
      randomUUID(),
    );
    await Promise.all([
      recordFailedAttempt(c.db, context, new Error()),
      recordFailedAttempt(c.db, { ...context, persistence: undefined }, new Error()),
    ]);
    assert.equal((await c.db.all('SELECT * FROM operation_attempts')).length, 1);
    assert.deepEqual(auditEvidenceMetrics(c.db), { saved: 1, duplicate: 1, writeFailures: 0 });
  } finally {
    await c.dispose();
  }
});

test('B6c-1 persisted event recursively redacts encoded credentials without dropping business lines', async () => {
  const c = await numberingFixture();
  try {
    const lines = Array.from({ length: 1000 }, (_, packages) => ({ productCode: '130', packages }));
    const payload = { lines, extra: JSON.stringify({ nested: [{ password: 'audit-secret', packages: 7 }] }) };
    await c.db.transaction((tx) =>
      audit(tx, actor, { action: 'test.redaction', targetId: 'redaction', before: null, after: payload }),
    );
    const row = await c.db.get("SELECT after_json FROM operation_log WHERE target_id='redaction'");
    const body = JSON.parse(String(row?.after_json));
    assert.deepEqual(body.lines, lines);
    assert.doesNotMatch(String(row?.after_json), /audit-secret/);
    assert.equal(JSON.parse(body.extra).nested[0].packages, 7);
  } finally {
    await c.dispose();
  }
});
