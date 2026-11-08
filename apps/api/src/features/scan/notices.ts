import type { Database } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';

export async function factContexts(db: Database, planId: string, after: string) {
  const rows = await db.all(
    `SELECT c.*,h.active_version_id,e.weight_tonnes AS current_weight,e.source_spec AS current_spec
    FROM scan_fact_context c JOIN scan_facts f ON f.id=c.fact_id
    LEFT JOIN catalog_head h ON h.id=1
    LEFT JOIN catalog_entries e ON e.version_id=h.active_version_id AND e.barcode=c.barcode
    WHERE f.plan_id=? AND f.id>? ORDER BY f.id LIMIT 51`,
    [planId, after],
  );
  const items = rows.slice(0, 50).map((r) => {
    const weightGrams = decimalToGrams(r.weight_tonnes),
      version = Number(r.catalog_version_id),
      active = Number(r.active_version_id);
    let notice: string | null = null;
    if (active !== version)
      notice =
        r.current_weight === null
          ? '当前目录已移除，历史版本事实已接收'
          : `该包基于 v${version}，当前目录 v${active}，重量 ${weightGrams / 1000}→${decimalToGrams(r.current_weight) / 1000}kg；已按 ${weightGrams / 1000}kg 接收`;
    return {
      factId: String(r.fact_id),
      outboundLineId: String(r.outbound_line_id),
      productCode: String(r.erp_product_code),
      catalogVersion: version,
      sourceSpec: r.source_spec === null ? null : String(r.source_spec),
      weightGrams,
      notice,
    };
  });
  return { items, nextFactId: rows.length > 50 ? items.at(-1)!.factId : null };
}
