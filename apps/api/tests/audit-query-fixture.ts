import { randomUUID } from 'node:crypto';
import { numberingFixture } from './numbering-fixture.ts';
import { actor } from './fixture.ts';
import { audit } from '../src/shared/audit.ts';
import { newAttempt } from '../src/features/audit/context.ts';
import { recordFailedAttempt } from '../src/features/audit/attempts.ts';
import { AppError } from '../src/shared/errors.ts';
export async function auditQueryFixture(count = 55) {
  const c = await numberingFixture(),
    trace = randomUUID(),
    target = randomUUID();
  for (let index = 0; index < count; index++)
    await c.db.transaction((tx) =>
      audit(
        tx,
        { ...actor, traceId: trace, channel: 'web' },
        {
          action: 'inbound.confirm',
          targetId: target,
          before: { packages: index, status: 'pending' },
          after: {
            receiptNo: 'RK-审计测试',
            packages: index + 1,
            status: 'confirmed',
            nested: { token: 'SECRET-NESTED' },
          },
        },
      ),
    );
  const context = newAttempt(
    { action: 'inbound.confirm', targetKind: 'inbound', targetId: target, channel: 'web' },
    trace,
  );
  context.actor = actor.username;
  await recordFailedAttempt(c.db, context, new AppError('CONFLICT', 'STATE_CODE', 409));
  // Simulate historical payloads written before recursive redaction was introduced.
  await c.db.run('UPDATE operation_attempts SET target_no=?,input_summary=? WHERE attempt_id=?', [
    'RK-审计测试',
    JSON.stringify({
      data: {
        token: 'SECRET-TOKEN',
        encoded: JSON.stringify({ cookie: 'SECRET-COOKIE', 凭证: 'SECRET-CREDENTIAL' }),
        items: [{ password: 'SECRET-PASSWORD', notes: 'credential=SECRET-PLAIN' }],
        密码: 'SECRET-CN',
      },
    }),
    context.attemptId,
  ]);
  const event = await c.db.get('SELECT id FROM operation_log WHERE trace_id=? ORDER BY id LIMIT 1', [trace]);
  return { ...c, trace, target, id: `event:${event!.id}`, attemptId: `attempt:${context.attemptId}`, count: count + 1 };
}
