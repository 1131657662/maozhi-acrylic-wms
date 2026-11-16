import { WORKBENCH } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { auditUnion, auditSafeFields } from '../audit/query.ts';
import { projectAuditRows } from '../audit/projection.ts';
import { select } from './metrics.ts';

export async function dashboardRecent(db: Database) {
  const rows = await db.all(
    `${select} ${auditSafeFields} FROM ${auditUnion}
    ORDER BY created_at DESC,record_id DESC LIMIT ?`,
    [WORKBENCH.recentLimit],
  );
  // At most one existence query per document kind, never per event.
  return projectAuditRows(db, rows);
}
