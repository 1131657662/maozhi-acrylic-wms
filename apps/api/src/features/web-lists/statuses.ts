import { webStatusOptionsSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';

export async function listWebStatuses(db: Database, kind: 'inbound' | 'outbound') {
  const table = kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
  const rows = await db.all(`SELECT DISTINCT status FROM ${table} WHERE source_del_flag=0 ORDER BY status`);
  return webStatusOptionsSchema.parse(rows.map((row) => row.status));
}
