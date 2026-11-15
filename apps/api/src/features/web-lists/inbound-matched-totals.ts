import type { WebInboundQuery, WebMatchedTotals } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { aggregateGrams, type ListReadQuery, type Predicate } from './query.ts';

export async function inboundMatchedTotals(
  db: Database,
  query: ListReadQuery<WebInboundQuery>,
  predicate: Predicate,
): Promise<WebMatchedTotals> {
  const sql = predicate.sql.replace(
    'FROM inbound_receipts r',
    'FROM inbound_lines l JOIN inbound_receipts r ON r.id=l.receipt_id',
  );
  const row = await db.get(
    `SELECT /*+ JOIN_ORDER(l,r) */ COUNT(DISTINCT l.receipt_id) AS documentCount,COUNT(*) AS lineCount,
      SUM(l.packages) AS packages,SUM(l.weight_tonnes) AS tonnes ${sql}
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
