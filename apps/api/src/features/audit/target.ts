import type { Database } from '../../db/mysql.ts';
import type { AttemptTarget } from './context.ts';

const documents: Record<string, { table: string; column: string }> = {
  inbound: { table: 'inbound_receipts', column: 'receipt_no' },
  outbound: { table: 'outbound_orders', column: 'order_no' },
  stocktake: { table: 'stocktakes', column: 'number' },
};
export async function attemptTarget(
  db: Database,
  target: AttemptTarget,
): Promise<{ number: string | null; label: string | null }> {
  const source = documents[target.targetKind ?? ''];
  if (!source || !target.targetId) return { number: null, label: null };
  const row = await db.get(`SELECT ${source.column} AS number FROM ${source.table} WHERE id=?`, [target.targetId]);
  return { number: typeof row?.number === 'string' ? row.number : null, label: null };
}
