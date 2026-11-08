import type { Database, Row } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { factInputSchema, scanContextInputSchema } from '@wms/contracts';

export const outstandingClientsSql = `SELECT a.client_key,a.legacy_requests,a.last_seen_at FROM catalog_client_activity a
 WHERE NOT EXISTS(SELECT 1 FROM pda_handoff_clients c JOIN pda_handoffs h ON h.id=c.handoff_id
 WHERE c.client_key=a.client_key AND h.confirmed_at IS NOT NULL
 AND c.observed_requests=a.legacy_requests AND c.observed_seen_at=a.last_seen_at)`;

export async function handoffHeader(db: Database, id: string) {
  const row = await db.get('SELECT * FROM pda_handoffs WHERE id=?', [id]);
  ensure(row, 'NOT_FOUND', '交接记录不存在');
  return row;
}
export async function handoffRows(db: Database, id: string) {
  return db.all(
    `SELECT r.*,f.payload_hash AS received_hash FROM pda_handoff_records r
    LEFT JOIN scan_facts f ON f.id=r.fact_id WHERE r.handoff_id=? ORDER BY r.fact_id`,
    [id],
  );
}
export function handoffSummary(header: Row, rows: Row[]) {
  const registered = rows.length,
    expected = Number(header.expected_count);
  const received = rows.filter((r) => r.received_hash === r.body_hash).length;
  const missingContext = rows.filter((r) => r.context_json === null).length;
  const manifestValid =
    registered === expected &&
    hash(JSON.stringify(rows.map((r) => [r.fact_id, r.plan_id, r.payload_sha]))) === header.manifest_sha;
  const reasons: string[] = [];
  if (!manifestValid) reasons.push(`队列清单尚未完整核验：${registered}/${expected}`);
  if (received < expected) reasons.push(`还有 ${expected - received} 条未收妥或正文不符`);
  if (missingContext) reasons.push(`还有 ${missingContext} 条需要确认原单作业行`);
  return {
    id: String(header.id),
    deviceId: String(header.device_id),
    appVersion: String(header.app_version),
    expectedCount: expected,
    registered,
    received,
    unresolved: Math.max(0, expected - received),
    missingContext,
    manifestValid,
    catalogVersion: Number(header.catalog_version),
    confirmedAt: header.confirmed_at === null ? null : String(header.confirmed_at),
    ready: reasons.length === 0,
    reasons,
  };
}
function recordView(row: Row) {
  const fact = factInputSchema.parse(JSON.parse(String(row.raw_payload)));
  return {
    factId: fact.id,
    planId: String(row.plan_id),
    barcode: fact.barcode,
    catalogVersion: fact.catalogVersion,
    weightGrams: fact.weightGrams,
    localState: String(row.local_state),
    received: row.received_hash !== null,
    payloadMatches: row.received_hash === row.body_hash,
    context: row.context_json === null ? null : scanContextInputSchema.parse(JSON.parse(String(row.context_json))),
  };
}
export async function handoffDetail(db: Database, id: string, page = 1) {
  const header = await handoffHeader(db, id),
    rows = await handoffRows(db, id);
  return {
    summary: handoffSummary(header, rows),
    items: rows.slice((page - 1) * 100, page * 100).map(recordView),
    total: rows.length,
  };
}
export async function handoffOverview(db: Database) {
  const headers = await db.all('SELECT * FROM pda_handoffs ORDER BY created_at DESC');
  const devices = [];
  for (const header of headers) devices.push(handoffSummary(header, await handoffRows(db, String(header.id))));
  const clients = (await db.all(outstandingClientsSql)).map((r) => ({
    clientKey: String(r.client_key),
    requests: Number(r.legacy_requests),
    lastSeen: String(r.last_seen_at),
  }));
  return { devices, clients };
}
