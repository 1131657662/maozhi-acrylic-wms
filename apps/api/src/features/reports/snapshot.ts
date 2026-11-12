import type { ReportWatermarks } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';

export const REPORT_BATCH_SIZE = 2000;
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;
const SNAPSHOT_MAX_ENTRIES = 256;
export interface DateCorrectionEvidence {
  id: string;
  documentKind: string;
  documentId: string;
  afterDate: string;
  revision: number;
}
export interface ReportSnapshot {
  database: string;
  watermarks: ReportWatermarks;
  corrections: DateCorrectionEvidence[];
}
interface CachedSnapshot {
  snapshot: ReportSnapshot;
  signature: string;
  expiresAt: number;
}
const snapshots = new Map<string, CachedSnapshot>();
export function reportQueryFingerprint(query: object, snapshot: ReportSnapshot): string {
  return hash(
    JSON.stringify(
      Object.fromEntries(
        Object.entries({ ...query, asOf: snapshot.watermarks.asOf }).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  );
}
export function rememberReportSnapshot(token: string, query: object, snapshot: ReportSnapshot): void {
  const now = Date.now();
  for (const [key, value] of snapshots) if (value.expiresAt <= now) snapshots.delete(key);
  snapshots.set(token, {
    snapshot,
    signature: reportQueryFingerprint(query, snapshot),
    expiresAt: now + SNAPSHOT_TTL_MS,
  });
  while (snapshots.size > SNAPSHOT_MAX_ENTRIES) snapshots.delete(snapshots.keys().next().value!);
}
async function replaySnapshot(db: Database, query: { asOf?: string }, token: string): Promise<ReportSnapshot> {
  const cached = snapshots.get(token);
  const database = String((await db.get('SELECT DATABASE() AS name'))?.name);
  if (!cached || cached.expiresAt <= Date.now() || cached.snapshot.database !== database)
    throw new AppError('EXPORT_VIEW_CHANGED', '报表快照已过期，请刷新查询后重新导出', 409);
  const { snapshot } = cached;
  if (
    reportQueryFingerprint(query, snapshot) !== cached.signature ||
    (query.asOf && new Date(query.asOf).toISOString() !== snapshot.watermarks.asOf)
  )
    throw new AppError('EXPORT_VIEW_CHANGED', '报表条件与查询快照不一致，请刷新后重新导出', 409);
  return snapshot;
}
export async function reportSnapshot(
  db: Database,
  query: { asOf?: string },
  viewToken?: string,
): Promise<ReportSnapshot> {
  if (viewToken) return replaySnapshot(db, query, viewToken);
  const head = await db.get(
    'SELECT DATABASE() AS name,UTC_TIMESTAMP(3) AS now,(SELECT MAX(id) FROM stock_journal) AS maximum',
  );
  const now = new Date(String(head!.now).replace(' ', 'T') + 'Z').toISOString();
  const asOf = query.asOf ? new Date(query.asOf).toISOString() : now;
  if (asOf > now) throw new AppError('REPORT_FUTURE', '数据截止时间不能晚于当前时间', 422);
  const corrections = await correctionEvidence(db, asOf);
  return {
    database: String(head!.name),
    corrections,
    watermarks: {
      journalMaxId: Number(head!.maximum ?? 0),
      dateCorrectionMaxId:
        corrections
          .map((row) => row.id)
          .sort()
          .at(-1) ?? null,
      asOf,
    },
  };
}
async function correctionEvidence(db: Database, asOf: string): Promise<DateCorrectionEvidence[]> {
  const rows = await db.all(
    `SELECT id,document_kind,document_id,after_date,revision
    FROM document_date_corrections WHERE created_at<=? ORDER BY document_kind,document_id,revision`,
    [asOf.replace('T', ' ').replace('Z', '')],
  );
  return rows.map((row) => ({
    id: String(row.id),
    documentKind: String(row.document_kind),
    documentId: String(row.document_id),
    afterDate: String(row.after_date),
    revision: Number(row.revision),
  }));
}
export function snapshotLocalTime(snapshot: ReportSnapshot): string {
  return new Date(Date.parse(snapshot.watermarks.asOf) + 8 * 3600000)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '000');
}
