import { messageCopy, type MessageType } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { executeTransaction } from '../../db/transaction-outcome.ts';
import { pendingSources, overdueSources, stocktakeSources, catalogSources } from './source-documents.ts';
import { backupSources, anomalySources } from './source-alerts.ts';
import { candidate } from './candidate.ts';
import { reconcile } from './reconcile.ts';

const sources: [MessageType, (db: Database, now: Date) => Promise<Row[]>][] = [
  ['pending', pendingSources],
  ['shipment_overdue', overdueSources],
  ['stocktake_overdue', stocktakeSources],
  ['catalog_stale', catalogSources],
  ['backup_failed', backupSources],
  ['anomaly', anomalySources],
];
async function scanTransaction(db: Database, now: Date) {
  const stats = [];
  for (const [type, read] of sources) {
    const candidates = (await read(db, now)).map((row) => candidate(type, row));
    stats.push({ type, ...(await reconcile(db, { type, candidates, now })) });
  }
  const cleaned = await db.run(
    `DELETE FROM notifications WHERE expires_at<=?
    AND (read_at IS NOT NULL OR resolved_at IS NOT NULL)`,
    [sqlDate(now.toISOString())],
  );
  await saveScan(db, now, 'succeeded', { stats, cleaned: cleaned.changes });
}
async function saveScan(db: Database, now: Date, status: string, detail: object) {
  await db.run(
    `INSERT INTO notification_scan_state VALUES('scan',?,?,?) ON DUPLICATE KEY UPDATE
    last_run_at=VALUES(last_run_at),last_status=VALUES(last_status),detail=VALUES(detail)`,
    [sqlDate(now.toISOString()), status, JSON.stringify(detail)],
  );
}
export async function scanMessages(db: Database, now = new Date()): Promise<void> {
  await db.withConnection(async (connection) => {
    const name = String((await connection.get('SELECT DATABASE() AS name'))?.name);
    const key = `messages:${name}`;
    if (Number((await connection.get('SELECT GET_LOCK(?,0) AS acquired', [key]))?.acquired) !== 1) return;
    try {
      await saveScan(connection, now, 'running', {});
      await executeTransaction(connection, (tx) => scanTransaction(tx, now));
    } catch (error) {
      await saveScan(connection, now, 'failed', { reason: messageCopy.scanFailed });
      throw error;
    } finally {
      await connection.get('SELECT RELEASE_LOCK(?)', [key]);
    }
  });
}
