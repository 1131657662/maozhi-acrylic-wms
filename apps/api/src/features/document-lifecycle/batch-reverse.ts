import { batchReverseResponseSchema, type BatchReverseCommand, type BatchReverseResponse } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { executeLifecycle } from './execute.ts';
import { withCommandAttempt } from '../audit/command.ts';
import { TransactionOutcomeUnknown } from '../../db/transaction-outcome.ts';

const numberColumns = {
  inbound: { table: 'inbound_receipts', column: 'receipt_no' },
  outbound: { table: 'outbound_orders', column: 'order_no' },
} as const;

async function trustedNumber(db: Database, kind: BatchReverseCommand['kind'], id: string): Promise<string> {
  const target = numberColumns[kind];
  try {
    const row = await db.get(
      `SELECT ${target.column} AS number FROM ${target.table} WHERE id=? AND source_del_flag=0`,
      [id],
    );
    return typeof row?.number === 'string' ? row.number : '未知单据';
  } catch {
    return '未知单据';
  }
}

function failure(error: unknown): { code: string; message: string } {
  if (error instanceof TransactionOutcomeUnknown) return { code: error.code, message: error.message };
  if (error instanceof AppError) {
    const safeMessages: Record<string, string> = {
      DOWNSTREAM_DEPENDENCY: '存在后续库存动作，禁止自动撤销。',
      STOCK_EVIDENCE_MISMATCH: '当前库存与原确认后值不一致，需先核实台账。',
    };
    return { code: error.code, message: safeMessages[error.code] ?? error.message };
  }
  return { code: 'INTERNAL_ERROR', message: '服务异常，请提供请求编号' };
}

export async function executeBatchReverse(
  db: Database,
  command: BatchReverseCommand,
  actor: Actor,
): Promise<BatchReverseResponse> {
  const results: BatchReverseResponse['results'] = [];
  for (const item of command.items) {
    try {
      const preview = await withCommandAttempt(db, {
        action: `${command.kind}.reverse`, targetKind: command.kind, targetId: item.id,
        actor, channel: actor.channel ?? null, input: {},
      }, () => executeLifecycle(db, {
        kind: command.kind,
        action: 'reverse',
        id: item.id,
        key: item.key,
        input: { reason: command.reason, expectedToken: item.expectedToken },
        actor,
      }));
      results.push({ id: item.id, number: preview.number, success: true, code: null, message: null });
    } catch (error) {
      const result = failure(error);
      results.push({
        id: item.id,
        number: await trustedNumber(db, command.kind, item.id),
        success: false,
        code: result.code,
        message: result.message,
      });
    }
  }
  return batchReverseResponseSchema.parse({
    kind: command.kind,
    total: results.length,
    succeeded: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  });
}
