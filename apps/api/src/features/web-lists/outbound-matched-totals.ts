import type { WebOutboundQuery, WebMatchedTotals } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { aggregateGrams, type ListReadQuery, type Predicate } from './query.ts';

export async function outboundMatchedTotals(
  db: Database,
  query: ListReadQuery<WebOutboundQuery>,
  predicate: Predicate,
): Promise<WebMatchedTotals> {
  const sql = predicate.sql.replace(
    'FROM outbound_orders o',
    'FROM outbound_lines l JOIN outbound_orders o ON o.id=l.order_id',
  );
  const row = await db.get(
    `SELECT /*+ JOIN_ORDER(l,o) */ COUNT(DISTINCT l.order_id) AS documentCount,COUNT(*) AS lineCount,
      SUM(l.planned_packages) AS packages,SUM(l.planned_weight_tonnes) AS tonnes ${sql}
      AND l.source_del_flag=0 AND l.product_code IN (${query.productCodes!.map(() => '?').join(',')})`,
    [...predicate.values, ...query.productCodes!],
  );
  return {
    documentCount: Number(row?.documentCount ?? 0),
    lineCount: Number(row?.lineCount ?? 0),
    packages: Number(row?.packages ?? 0),
    weightGrams: aggregateGrams(row?.tonnes ?? '0.0000'),
  };
}
