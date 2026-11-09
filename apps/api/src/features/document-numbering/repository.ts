import type { DocumentKind } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';

export const prefixes = { inbound: 'RK', outbound: 'CK', correction: 'GZ' } as const;
export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replaceAll('-', '');
}
export async function lockNumbering(db: Database): Promise<void> {
  // Same first lock as document creation; held until document/idempotency commit.
  await db.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
}
export async function readRule(db: Database, kind: DocumentKind) {
  const row = await db.get('SELECT sequence_width,version FROM document_number_rules WHERE kind=?', [kind]);
  return { width: row ? Number(row.sequence_width) : 4, version: row ? Number(row.version) : 0 };
}
export async function numberExists(db: Database, number: string): Promise<boolean> {
  const inbound = await db.get('SELECT id FROM inbound_receipts WHERE receipt_no=?', [number]);
  const outbound = await db.get('SELECT id FROM outbound_orders WHERE order_no=?', [number]);
  const correction = await db.get('SELECT id FROM document_corrections WHERE number=?', [number]);
  return Boolean(inbound || outbound || correction);
}
export async function lastSequence(db: Database, kind: DocumentKind, date: string): Promise<bigint> {
  const counter = await db.get('SELECT last_sequence FROM document_number_counters WHERE kind=? AND date_key=?', [
    kind,
    date,
  ]);
  if (counter) return BigInt(String(counter.last_sequence));
  const prefix = `${prefixes[kind]}-${date}-`;
  const pattern = new RegExp(`^${prefix}([0-9]+)$`);
  const inbound = await db.all('SELECT receipt_no AS number FROM inbound_receipts WHERE receipt_no LIKE ?', [
    `${prefix}%`,
  ]);
  const outbound = await db.all('SELECT order_no AS number FROM outbound_orders WHERE order_no LIKE ?', [`${prefix}%`]);
  const corrections = await db.all('SELECT number FROM document_corrections WHERE number LIKE ?', [`${prefix}%`]);
  return [...inbound, ...outbound, ...corrections].reduce((max, row) => {
    const match = pattern.exec(String(row.number));
    const value = match ? BigInt(match[1]!) : 0n;
    return value > max ? value : max;
  }, 0n);
}
export async function ensureRule(db: Database, kind: DocumentKind): Promise<void> {
  await db.run(
    `INSERT INTO document_number_rules(kind,sequence_width) VALUES(?,4)
    ON DUPLICATE KEY UPDATE kind=VALUES(kind)`,
    [kind],
  );
}
