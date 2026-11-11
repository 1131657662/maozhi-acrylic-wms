import type { Database } from '../../db/mysql.ts';
import { auditContext, newAttempt, type AttemptTarget, type AuditIdentity } from './context.ts';
import { recordFailedAttempt } from './attempts.ts';

interface CommandAttempt extends AttemptTarget {
  actor: AuditIdentity;
  input: unknown;
}
export async function withCommandAttempt<T>(db: Database, command: CommandAttempt, work: () => Promise<T>): Promise<T> {
  const parent = auditContext.getStore();
  const context = newAttempt(command, parent?.traceId ?? command.actor.traceId);
  context.actor = parent?.actor ?? command.actor.username;
  context.channel = parent?.channel ?? command.actor.channel ?? command.channel;
  context.input = command.input;
  return auditContext.run(context, async () => {
    try {
      return await work();
    } catch (error) {
      await recordFailedAttempt(db, context, error);
      throw error;
    }
  });
}
