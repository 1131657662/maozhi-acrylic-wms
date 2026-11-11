import {
  auditAction,
  auditChannelText,
  auditResultText,
  auditEffectText,
  auditObjectNames,
  auditRowSchema,
  type AuditRow,
} from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { redactAuditValue } from './sanitize.ts';
const destinations: Record<string, { table: string; path: string }> = {
  inbound: { table: 'inbound_receipts', path: '/inbound/' },
  outbound: { table: 'outbound_orders', path: '/outbound/' },
  stocktake: { table: 'stocktakes', path: '/stocktakes/' },
};
export function businessText(value: unknown, fallback = '未记录'): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  if (/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(value)) return fallback;
  const safe = redactAuditValue(value);
  return typeof safe === 'string' && safe !== '[已隐藏]' ? safe : fallback;
}
export async function projectAuditRows(db: Database, rows: Row[]): Promise<AuditRow[]> {
  const links = new Map<string, string>();
  for (const [kind, source] of Object.entries(destinations)) {
    const ids = [
      ...new Set(rows.filter((row) => row.target_kind === kind && row.target_id).map((row) => String(row.target_id))),
    ];
    if (!ids.length) continue;
    const active = kind === 'stocktake' ? '' : ' AND source_del_flag=0';
    const existing = await db.all(
      `SELECT id FROM ${source.table} WHERE id IN (${ids.map(() => '?').join(',')})${active}`,
      ids,
    );
    for (const row of existing) links.set(`${kind}:${row.id}`, `${source.path}${encodeURIComponent(String(row.id))}`);
  }
  return rows.map((row) => project(row, links.get(`${row.target_kind}:${row.target_id}`) ?? null));
}
function project(row: Row, href: string | null): AuditRow {
  const action = auditAction(String(row.action));
  const label = action?.label ?? '未识别';
  const result = auditResultText(row.result);
  return auditRowSchema.parse({
    id: row.record_id,
    source: row.source,
    sourceId: row.source_id,
    action: label,
    dangerous: action?.dangerous ?? false,
    objectType:
      row.target_kind == null
        ? '未记录'
        : Object.hasOwn(auditObjectNames, String(row.target_kind))
          ? auditObjectNames[String(row.target_kind)]
          : '未识别',
    objectLabel: businessText(row.target_no ?? row.target_label),
    href,
    actor: businessText(row.actor),
    createdAt: isoDate(row.created_at),
    summary: businessText(row.summary),
    channel: auditChannelText(row.channel),
    result,
    effect: auditEffectText(row.effect_state),
  });
}
