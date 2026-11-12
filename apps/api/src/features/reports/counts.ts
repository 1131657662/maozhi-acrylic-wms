import type { ReportQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Cell } from './types.ts';
import { balanceFrom, dimensionFilter, movementPredicate, postedLocal, validPosted } from './sql.ts';
import { nextDay } from './periods.ts';

// Group before counting: a multi-product document counts once per cell, never as an additive grand total.
export async function documentCounts(db: Database, cells: Map<string, Cell>, query: ReportQuery): Promise<void> {
  const filter = dimensionFilter(query);
  const rows = await db.all(
    `SELECT LEFT(${postedLocal},7) AS period,s.warehouse_code,s.product_code,
    CASE WHEN sc.inbound_receipt_id IS NOT NULL THEN 'inbound.confirm' WHEN sc.outbound_order_id IS NOT NULL THEN 'outbound.confirm'
      ELSE COALESCE(o.operation_type,s.source_business_type) END AS kind,
    COUNT(DISTINCT CASE WHEN o.operation_type LIKE '%.reverse' THEN s.operation_id
      ELSE COALESCE(s.inbound_receipt_id,s.order_id,sc.inbound_receipt_id,sc.outbound_order_id,NULLIF(s.source_order_no,'')) END) AS documents,
    SUM(CASE WHEN o.operation_type LIKE '%.reverse' THEN s.operation_id IS NULL
      ELSE COALESCE(s.inbound_receipt_id,s.order_id,sc.inbound_receipt_id,sc.outbound_order_id,NULLIF(s.source_order_no,'')) IS NULL END) AS missing
    ${balanceFrom} WHERE s.source_del_flag=0 AND ${movementPredicate} AND ${validPosted}
    AND ${postedLocal}>=? AND ${postedLocal}<? ${filter.sql}
    GROUP BY period,s.warehouse_code,s.product_code,kind`,
    [query.fromDay + ' 00:00:00', nextDay(query.toDay) + ' 00:00:00', ...filter.values],
  );
  for (const row of rows) {
    const month = cells.get(JSON.stringify([row.warehouse_code, row.product_code]))?.periods.get(String(row.period));
    if (!month) continue;
    const kind = String(row.kind);
    const field = kind.startsWith('inbound')
      ? kind.endsWith('.reverse')
        ? 'inboundReversals'
        : 'inboundDocuments'
      : kind.endsWith('.reverse')
        ? 'outboundReversals'
        : 'outboundDocuments';
    month[field] = Number(row.missing) > 0 || month[field] === null ? null : month[field] + Number(row.documents);
  }
}
