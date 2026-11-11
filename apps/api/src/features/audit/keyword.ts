import { contains, type Predicate } from '../web-lists/query.ts';

export function auditKeyword(parts: Predicate, keyword: string): void {
  if (!keyword) return;
  // EXISTS keeps one row per audit event and never parses historical JSON.
  parts.sql += ` AND (target_no LIKE ? ESCAPE '!' OR target_label LIKE ? ESCAPE '!' OR actor LIKE ? ESCAPE '!'
    OR (target_kind='inbound' AND EXISTS (SELECT 1 FROM inbound_lines l
      WHERE l.receipt_id=audit_records.target_id AND (l.product_code LIKE ? ESCAPE '!' OR l.product_name_snapshot LIKE ? ESCAPE '!')))
    OR (target_kind='outbound' AND EXISTS (SELECT 1 FROM outbound_lines l
      WHERE l.order_id=audit_records.target_id AND (l.product_code LIKE ? ESCAPE '!' OR l.product_name LIKE ? ESCAPE '!'))))`;
  parts.values.push(...Array<string>(7).fill(contains(keyword)));
}
