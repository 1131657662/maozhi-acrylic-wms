import { messageCopy, messageScanSchema, type MessageScan } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';

export async function messageScanHealth(db: Database): Promise<MessageScan> {
  try {
    const row = await db.get("SELECT last_run_at,last_status FROM notification_scan_state WHERE `key`='scan'");
    if (!row) return { at: null, status: 'unknown', reason: messageCopy.scanUnknown };
    return messageScanSchema.parse({
      at: isoDate(row.last_run_at),
      status: row.last_status,
      reason: row.last_status === 'failed' || row.last_status === 'interrupted' ? messageCopy.scanFailed : null,
    });
  } catch {
    return { at: null, status: 'failed', reason: messageCopy.scanFailed };
  }
}
