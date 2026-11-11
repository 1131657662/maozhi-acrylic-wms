import type { Database } from '../../db/mysql.ts';
import { logger } from '../../shared/logger.ts';
import { auditContext, type AttemptContext } from './context.ts';
import { inputSummary } from './input-summary.ts';
import { failureEvidence } from './failure.ts';
import { attemptTarget } from './target.ts';

interface EvidenceMetrics {
  saved: number;
  duplicate: number;
  writeFailures: number;
}
const metrics = new WeakMap<Database, EvidenceMetrics>();
function counters(db: Database): EvidenceMetrics {
  let value = metrics.get(db);
  if (!value) {
    value = { saved: 0, duplicate: 0, writeFailures: 0 };
    metrics.set(db, value);
  }
  return value;
}
export function auditEvidenceMetrics(db: Database): Readonly<EvidenceMetrics> {
  return { ...counters(db) };
}

async function insertFailure(db: Database, context: AttemptContext, error: unknown): Promise<boolean> {
  const evidence = failureEvidence(error, context);
  const target = await attemptTarget(db, context);
  const result = await db.run(
    `INSERT INTO operation_attempts
    (attempt_id,actor,channel,action,target_kind,target_id,target_no,target_label,result,effect_state,
     error_code,failure_reason,trace_id,occurred_at,input_summary)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),?)`,
    [
      context.attemptId,
      context.actor,
      context.channel,
      context.action,
      context.targetKind,
      context.targetId,
      target.number,
      target.label,
      evidence.result,
      evidence.effectState,
      evidence.code,
      evidence.reason,
      context.traceId,
      JSON.stringify(inputSummary(context.action, context.input)),
    ],
  );
  return result.changes === 1;
}
function duplicate(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
async function persist(db: Database, context: AttemptContext, error: unknown): Promise<boolean> {
  const count = counters(db);
  try {
    await auditContext.run(undefined, () => db.transaction((tx) => insertFailure(tx, context, error)));
    count.saved++;
    return true;
  } catch (writeError) {
    if (duplicate(writeError)) {
      count.duplicate++;
      return true;
    }
    count.writeFailures++;
    // Fixed fields only: never log the SQL error, request body, headers, original message or stack.
    logger.error(
      {
        event: 'audit_attempt_write_failed',
        metric: 'audit_attempt_write_failures_total',
        value: count.writeFailures,
        attemptId: context.attemptId,
        traceId: context.traceId,
        saved: false,
      },
      '失败尝试未能保存',
    );
    return false;
  }
}
export function recordFailedAttempt(db: Database, context: AttemptContext, error: unknown): Promise<boolean> {
  context.persistence ??= persist(db, context, error);
  return context.persistence;
}
