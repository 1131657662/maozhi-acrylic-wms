import type { CorrectionKind } from '@wms/contracts';

// Called only with static SQL aliases, never request data. Unique version index selects one date per document.
export function effectiveBusinessDateSql(kind: CorrectionKind, alias: 'r' | 'o' | 'outbound_orders') {
  return `COALESCE((SELECT dc.after_date FROM document_date_corrections dc
    WHERE dc.document_kind='${kind}' AND dc.document_id=${alias}.id
    ORDER BY dc.revision DESC LIMIT 1),${alias}.business_date)`;
}
