import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { numberingFixture, newReceipt, origin } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';

test('B6c-1 lost COMMIT acknowledgment retains unknown outcome; replay does not compensate twice', async () => {
  const c = await numberingFixture();
  try {
    const receipt = await createInbound(c.db, newReceipt(), randomUUID(), actor),
      key = randomUUID();
    const withConnection = c.db.withConnection.bind(c.db);
    let injected = false;
    c.db.withConnection = (work) =>
      withConnection(async (connection) => {
        const run = connection.run.bind(connection);
        connection.run = async (sql, values) => {
          const result = await run(sql, values);
          if (sql === 'COMMIT' && !injected) {
            injected = true;
            throw new Error('lost commit acknowledgement');
          }
          return result;
        };
        return work(connection);
      });
    const response = await c.web
      .post(`/api/v1/inbound/${receipt.id}/confirm`)
      .set('Origin', origin)
      .set('Idempotency-Key', key)
      .send({})
      .expect(500);
    assert.equal(response.body.code, 'TRANSACTION_OUTCOME_UNKNOWN');
    assert.match(response.body.message, /待核实/);
    const evidence = await c.db.get('SELECT result,effect_state FROM operation_attempts WHERE trace_id=?', [
      response.body.traceId,
    ]);
    assert.deepEqual(evidence, { result: 'unknown', effect_state: 'unknown' });
    await c.web
      .post(`/api/v1/inbound/${receipt.id}/confirm`)
      .set('Origin', origin)
      .set('Idempotency-Key', key)
      .send({})
      .expect(200);
    assert.equal((await c.db.all('SELECT id FROM inventory_operations WHERE target_id=?', [receipt.id])).length, 1);
    assert.equal(
      (await c.db.all("SELECT id FROM operation_log WHERE target_id=? AND action='inbound.confirm'", [receipt.id]))
        .length,
      1,
    );
    console.log('B6C1_UNCERTAIN result=unknown label=结果待核实 same_key_replay_operations=1 successEvents=1');
  } finally {
    await c.dispose();
  }
});
