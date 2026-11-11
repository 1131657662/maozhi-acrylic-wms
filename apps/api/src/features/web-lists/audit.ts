import { webAuditListSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { pageResult, readPage } from './query.ts';
import { auditPredicate, auditSort, auditSafeFields, type AuditQuery } from '../audit/query.ts';
import { projectAuditRows } from '../audit/projection.ts';
export { readWebAudit } from '../audit/detail.ts';
export { auditPredicate } from '../audit/query.ts';
export async function listWebAudit(db: Database, query: AuditQuery) {
  return db.transaction(async (tx) => {
    const page = await readPage(
      tx,
      {
        fields: auditSafeFields,
        predicate: auditPredicate(query),
        order: `${auditSort[query.sortBy]} ${query.direction},record_id ${query.direction}`,
      },
      query,
    );
    return webAuditListSchema.parse(pageResult(await projectAuditRows(tx, page.rows), page.total, query));
  });
}
