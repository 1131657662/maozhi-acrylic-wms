import type { AnalysisQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { shiftDay } from '../reports/derived-common.ts';
import type { ReportSnapshot } from '../reports/snapshot.ts';
import { businessText } from '../audit/projection.ts';

function utcBoundary(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 8 * 3_600_000).toISOString().replace('T', ' ').slice(0, 23);
}

function elapsedHours(createdAt: string, asOf: string): number {
  return Math.round(Math.max(0, (Date.parse(asOf) - Date.parse(createdAt)) / 3_600_000) * 10) / 10;
}

function oldestPending(row: Row, asOf: string) {
  if (!row.pendingCreatedAt) return null;
  const createdAt = isoDate(row.pendingCreatedAt);
  return {
    kind: row.pendingKind === 'inbound' ? ('inbound' as const) : ('outbound' as const),
    number: businessText(row.pendingNumber, '单号未记录'),
    createdAt,
    elapsedHours: elapsedHours(createdAt, asOf),
  };
}

export async function durationSummary(db: Database, query: AnalysisQuery, snapshot: ReportSnapshot) {
  const start = utcBoundary(query.fromDay),
    end = utcBoundary(shiftDay(query.toDay, 1)),
    asOf = snapshot.watermarks.asOf.replace('T', ' ').replace('Z', '');
  const row = await db.get(
    `WITH pending AS (
      SELECT 'inbound' AS kind,r.receipt_no AS number,r.created_at,r.id
      FROM inbound_receipts r WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state='pending' AND r.created_at<=?
      UNION ALL
      SELECT 'outbound',o.order_no,o.created_at,o.id
      FROM outbound_orders o WHERE o.source_del_flag=0 AND o.source_id IS NULL
        AND o.status IN ('open','frozen','partially_shipped') AND o.created_at<=?
    ), oldest AS (
      SELECT kind,number,created_at FROM pending ORDER BY created_at,id LIMIT 1
    ), outbound_final AS (
      SELECT order_id,MAX(shipped_at) AS final_shipped_at FROM outbound_shipments GROUP BY order_id
    ), inbound_stats AS (
      SELECT COUNT(*) AS completed,
        AVG(TIMESTAMPDIFF(MICROSECOND,r.created_at,op.created_at)/3600000000) AS average_hours
      FROM inbound_receipts r JOIN inventory_operations op ON op.id=r.confirmation_operation_id
        AND op.operation_type='inbound.confirm' AND op.target_id=r.id
      WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state='confirmed'
        AND op.created_at>=r.created_at AND op.created_at>=? AND op.created_at<? AND op.created_at<=?
    ), outbound_stats AS (
      SELECT COUNT(*) AS completed,
        AVG(TIMESTAMPDIFF(MICROSECOND,o.created_at,f.final_shipped_at)/3600000000) AS average_hours
      FROM outbound_orders o JOIN outbound_final f ON f.order_id=o.id
      WHERE o.source_del_flag=0 AND o.source_id IS NULL AND o.status='confirmed'
        AND f.final_shipped_at>=o.created_at AND f.final_shipped_at>=? AND f.final_shipped_at<? AND f.final_shipped_at<=?
    )
    SELECT i.completed AS inboundCompleted,i.average_hours AS inboundAverageHours,
      o.completed AS outboundCompleted,o.average_hours AS outboundAverageHours,
      (SELECT COUNT(*) FROM inbound_receipts r LEFT JOIN inventory_operations op ON op.id=r.confirmation_operation_id
        AND op.operation_type='inbound.confirm' AND op.target_id=r.id
        WHERE r.source_del_flag=0 AND r.source_id IS NULL AND r.posting_state='confirmed'
          AND r.created_at<? AND r.created_at<=?
          AND (op.id IS NULL OR op.created_at<r.created_at)) AS inboundMissing,
      (SELECT COUNT(*) FROM outbound_orders b LEFT JOIN outbound_final f ON f.order_id=b.id
        WHERE b.source_del_flag=0 AND b.source_id IS NULL AND b.status='confirmed'
          AND b.created_at<? AND b.created_at<=?
          AND (f.order_id IS NULL OR f.final_shipped_at<b.created_at)) AS outboundMissing,
      oldest.kind AS pendingKind,oldest.number AS pendingNumber,oldest.created_at AS pendingCreatedAt
    FROM inbound_stats i CROSS JOIN outbound_stats o LEFT JOIN oldest ON 1=1`,
    [asOf, asOf, start, end, asOf, start, end, asOf, end, asOf, end, asOf],
  );
  return {
    inboundAverageHours:
      row?.inboundAverageHours == null || Number(row.inboundMissing) > 0 ? null : Number(row.inboundAverageHours),
    inboundCompleted: Number(row?.inboundCompleted ?? 0),
    outboundAverageHours:
      row?.outboundAverageHours == null || Number(row.outboundMissing) > 0 ? null : Number(row.outboundAverageHours),
    outboundCompleted: Number(row?.outboundCompleted ?? 0),
    longestPending: row ? oldestPending(row, snapshot.watermarks.asOf) : null,
    missingEvidence: Number(row?.inboundMissing ?? 0) + Number(row?.outboundMissing ?? 0),
  };
}
