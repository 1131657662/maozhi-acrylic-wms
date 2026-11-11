import type { Database } from './mysql.ts';
import { observeAuditTransaction } from '../features/audit/context.ts';

export class TransactionOutcomeUnknown extends Error {
  readonly code = 'TRANSACTION_OUTCOME_UNKNOWN';
  constructor(cause: unknown) {
    super('处理结果待核实，请先查看单据状态，再使用原请求重试', { cause });
  }
}
async function rollback(db: Database, error: unknown): Promise<never> {
  try {
    await db.run('ROLLBACK');
  } catch {
    observeAuditTransaction('unknown');
    throw new TransactionOutcomeUnknown(error);
  }
  observeAuditTransaction('rolled_back');
  throw error;
}
export async function executeTransaction<T>(db: Database, work: (db: Database) => Promise<T>): Promise<T> {
  await db.run('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await db.run('START TRANSACTION');
  observeAuditTransaction('started');
  let result: T;
  try {
    result = await work(db);
  } catch (error) {
    return rollback(db, error);
  }
  try {
    await db.run('COMMIT');
  } catch (error) {
    // A lost COMMIT acknowledgement can mean committed. Even a successful ROLLBACK cannot undo it.
    try {
      await db.run('ROLLBACK');
    } catch {
      /* The outcome remains unknown. */
    }
    observeAuditTransaction('unknown');
    throw new TransactionOutcomeUnknown(error);
  }
  observeAuditTransaction('committed');
  return result;
}
