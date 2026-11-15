import { webAuditListSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { pageResult, readPage } from './query.ts';
import {
  auditPredicate,
  auditSort,
  auditSafeFields,
  auditUnion,
  eventProjection,
  attemptProjection,
  type AuditQuery,
} from '../audit/query.ts';
import { projectAuditRows } from '../audit/projection.ts';
import { auditStatistics } from '../audit/statistics.ts';
export { readWebAudit } from '../audit/detail.ts';
export { auditPredicate } from '../audit/query.ts';
export async function listWebAudit(db: Database, query: AuditQuery) {
  return db.transaction(async (tx) => {
    const statistics = query.exportSnapshot ? undefined : await auditStatistics(tx, query);
    const predicate = auditPredicate(query);
    const page = await readPage(
      tx,
      {
        fields: auditSafeFields,
        predicate,
        branches: query.exportKeyset
          ? [eventProjection, attemptProjection].map((projection) => ({
              sql: predicate.sql.replace(`FROM ${auditUnion}`, `FROM (${projection}) audit_records`),
              values: predicate.values,
              load: (selection: string) => `${projection} JOIN (${selection}) export_keys
            ON ${projection === eventProjection ? 'operation_log.id' : 'operation_attempts.attempt_id'}=export_keys.source_id`,
            }))
          : undefined,
        keys: [auditSort[query.sortBy], 'record_id'],
        order: `${auditSort[query.sortBy]} ${query.direction},record_id ${query.direction}`,
      },
      { ...query, exportSnapshot: query.exportSnapshot ?? { total: statistics!.records } },
    );
    return webAuditListSchema.parse({
      ...pageResult(await projectAuditRows(tx, page.rows), page.total, query),
      statistics,
    });
  });
}
