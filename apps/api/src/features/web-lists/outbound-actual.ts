import type { Database } from '../../db/mysql.ts';
import { originalActualSql } from '../outbound/original-actual.ts';

// Before migration 016, confirmed documents used immutable scan facts as their actual quantities.
// An existing shipment always takes precedence, including an explicit zero quantity.
const original = originalActualSql({ orderId: 'o.id' });
export const actualPackagesSql = `(COALESCE(${original.packages},
  CASE WHEN o.status IN ('confirmed','cancelled') THEN
    (SELECT COUNT(*) FROM scan_facts f JOIN scan_fact_context c ON c.fact_id=f.id
      JOIN outbound_lines l ON l.id=c.outbound_line_id AND l.source_del_flag=0 WHERE f.plan_id=o.id)
  ELSE 0 END) + COALESCE((SELECT SUM(cl.packages_delta) FROM document_corrections c
    JOIN document_correction_lines cl ON cl.correction_id=c.id
    WHERE c.outbound_order_id=o.id AND c.offset_operation_id IS NULL),0))`;
export const actualGramsSql = `(COALESCE(${original.grams},
  CASE WHEN o.status IN ('confirmed','cancelled') THEN
    (SELECT COALESCE(SUM(f.weight_tonnes)*1000000,0) FROM scan_facts f
      JOIN scan_fact_context c ON c.fact_id=f.id
      JOIN outbound_lines l ON l.id=c.outbound_line_id AND l.source_del_flag=0 WHERE f.plan_id=o.id)
  ELSE 0 END) + COALESCE((SELECT SUM(cl.tonnes_delta)*1000000 FROM document_corrections c
    JOIN document_correction_lines cl ON cl.correction_id=c.id
    WHERE c.outbound_order_id=o.id AND c.offset_operation_id IS NULL),0))`;

export async function outboundActuals(db: Database, ids: string[]) {
  const rows = await db.all(
    `SELECT o.id,${actualPackagesSql} AS packages,${actualGramsSql} AS grams
    FROM outbound_orders o WHERE o.id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  return new Map(
    rows.map((row) => [String(row.id), { packages: Number(row.packages), weightGrams: Number(row.grams) }]),
  );
}
