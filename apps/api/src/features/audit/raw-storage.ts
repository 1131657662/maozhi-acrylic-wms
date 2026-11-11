import type { Database, Row } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { redactAuditValue } from './sanitize.ts';

export function assertBytes(bytes: number, limit: number): void {
  if (bytes > limit)
    throw new AppError('AUDIT_SIZE_LIMIT', `记录大小 ${bytes} 字节，超过允许的 ${limit} 字节，请缩小范围`, 422);
}
const sources = [
  {
    name: 'business_event',
    table: 'operation_log',
    id: 'id',
    prefix: 'event:',
    json: ['before_json', 'after_json', 'projection_json'],
  },
  { name: 'attempt', table: 'operation_attempts', id: 'attempt_id', prefix: 'attempt:', json: ['input_summary'] },
];
export async function rawRows(db: Database, rows: Row[], budget: number) {
  const records = new Map<string, unknown>();
  let loaded = 0;
  for (const source of sources) {
    const ids = rows.filter((row) => row.source === source.name).map((row) => String(row.source_id));
    if (!ids.length) continue;
    const from = `FROM ${source.table} WHERE ${source.id} IN (${ids.map(() => '?').join(',')})`;
    const lengths = source.json.map((key) => `COALESCE(OCTET_LENGTH(${key}),0)`).join('+');
    // Reject oversized stored payloads before transferring/decoding large JSON values.
    const measure = await db.get(`SELECT SUM(${lengths}) AS payload_bytes ${from}`, ids);
    loaded += Number(measure?.payload_bytes ?? 0);
    assertBytes(loaded, budget);
    const found = await db.all(`SELECT * ${from}`, ids);
    for (const row of found) records.set(source.prefix + row[source.id], redactAuditValue(row));
  }
  return rows.map((row) => ({
    id: row.record_id,
    source: row.source,
    sourceId: row.source_id,
    record: records.get(String(row.record_id)),
  }));
}
