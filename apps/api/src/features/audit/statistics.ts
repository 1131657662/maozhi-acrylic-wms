import { auditActions, auditObjectNames, shanghaiToday, type AuditStatistics } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { auditPredicate, type AuditQuery } from './query.ts';

export async function auditStatistics(db: Database, query: AuditQuery): Promise<AuditStatistics> {
  const predicate = auditPredicate(query);
  const dangerous = Object.entries(auditActions)
    .filter(([, action]) => action.dangerous)
    .map(([key]) => key);
  const kinds = Object.keys(auditObjectNames);
  const row = await db.get(
    `SELECT COUNT(*) AS records,
    COALESCE(SUM(result='failed'),0) AS failures,
    COUNT(DISTINCT IF(target_kind IN (${kinds.map(() => '?').join(',')}),target_kind,NULL),target_id) AS objects,
    COALESCE(SUM(action IN (${dangerous.map(() => '?').join(',')})),0) AS dangerous ${predicate.sql}`,
    [...kinds, ...dangerous, ...predicate.values],
  );
  const today = shanghaiToday();
  return {
    records: Number(row?.records ?? 0),
    failures: Number(row?.failures ?? 0),
    objects: Number(row?.objects ?? 0),
    dangerous: Number(row?.dangerous ?? 0),
    today:
      Date.parse(query.from ?? '') === Date.parse(`${today}T00:00:00+08:00`) &&
      Date.parse(query.to ?? '') === Date.parse(`${today}T23:59:59.999+08:00`),
  };
}
