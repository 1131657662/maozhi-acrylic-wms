import type { Database } from '../../db/mysql.ts';

// Before migration 016, confirmed documents used immutable scan facts as their actual quantities.
// An existing shipment always takes precedence, including an explicit zero quantity.
export const actualPackagesSql = `COALESCE((SELECT SUM(sl.packages) FROM outbound_shipments sh
  JOIN outbound_shipment_lines sl ON sl.shipment_id=sh.id WHERE sh.order_id=o.id),
  CASE WHEN o.status IN ('confirmed','cancelled') THEN
    (SELECT COUNT(*) FROM scan_facts f JOIN scan_fact_context c ON c.fact_id=f.id
      JOIN outbound_lines l ON l.id=c.outbound_line_id AND l.source_del_flag=0 WHERE f.plan_id=o.id)
  ELSE 0 END)`;
export const actualGramsSql = `COALESCE((SELECT SUM(sl.weight_grams) FROM outbound_shipments sh
  JOIN outbound_shipment_lines sl ON sl.shipment_id=sh.id WHERE sh.order_id=o.id),
  CASE WHEN o.status IN ('confirmed','cancelled') THEN
    (SELECT COALESCE(SUM(f.weight_tonnes)*1000000,0) FROM scan_facts f
      JOIN scan_fact_context c ON c.fact_id=f.id
      JOIN outbound_lines l ON l.id=c.outbound_line_id AND l.source_del_flag=0 WHERE f.plan_id=o.id)
  ELSE 0 END)`;

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
