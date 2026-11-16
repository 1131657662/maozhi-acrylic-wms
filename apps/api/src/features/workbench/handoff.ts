import type { WorkbenchPeriod } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { metric, select } from './metrics.ts';

export async function dashboardHandoff(db: Database, period: WorkbenchPeriod) {
  const registered = await db.get(`${select}
    COUNT(DISTINCT CASE WHEN f.id IS NULL THEN r.fact_id END) AS unresolved,
    COUNT(DISTINCT CASE WHEN f.id IS NULL THEN r.plan_id END) AS orders,MAX(h.created_at) AS registered_at
    FROM pda_handoff_records r JOIN pda_handoffs h ON h.id=r.handoff_id
    LEFT JOIN scan_facts f ON f.id=r.fact_id AND f.payload_hash=r.body_hash`);
  const conflicts = await db.get(`${select} COUNT(*) AS conflicts,MAX(occurred_at) AS conflict_at
    FROM operation_attempts WHERE action='scan.record' AND result='failed'
    AND error_code IN ('IDEMPOTENCY_CONFLICT','DUPLICATE_BARCODE','FACT_CONTEXT_MISMATCH','WEIGHT_MISMATCH','PRODUCT_MISMATCH')`);
  const current = { from: period.to, to: period.to };
  return {
    unresolved: metric(Number(registered?.unresolved ?? 0), '条', current),
    orders: metric(Number(registered?.orders ?? 0), '单', current),
    conflicts: metric(Number(conflicts?.conflicts ?? 0), '条', current),
    registeredAt: registered?.registered_at ? isoDate(registered.registered_at) : null,
    conflictAt: conflicts?.conflict_at ? isoDate(conflicts.conflict_at) : null,
  };
}
