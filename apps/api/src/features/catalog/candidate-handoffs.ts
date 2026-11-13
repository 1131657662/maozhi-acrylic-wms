import { CATALOG_HANDOFF_PAGE_SIZE, catalogCandidateHandoffsSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { handoffRows, handoffSummary } from '../handoff/read.ts';
import { getVersion } from './repository.ts';
import { isoDate } from '../../db/dates.ts';

export async function candidateHandoffs(db: Database, input: { versionId: number; page: number }) {
  return db.readSnapshot(async (tx) => {
    const { baseVersionId } = await getVersion(tx, input.versionId);
    const count = await tx.get('SELECT COUNT(*) AS n FROM pda_handoffs WHERE catalog_version=?', [baseVersionId]);
    const headers = await tx.all(
      'SELECT * FROM pda_handoffs WHERE catalog_version=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?',
      [baseVersionId, CATALOG_HANDOFF_PAGE_SIZE, (input.page - 1) * CATALOG_HANDOFF_PAGE_SIZE],
    );
    const items = [];
    for (const header of headers) {
      const summary = handoffSummary(header, await handoffRows(tx, String(header.id)));
      items.push({
        createdAt: isoDate(header.created_at),
        expectedCount: summary.expectedCount,
        registered: summary.registered,
        received: summary.received,
        unresolved: summary.unresolved,
        confirmedAt: summary.confirmedAt ? isoDate(summary.confirmedAt) : null,
      });
    }
    return catalogCandidateHandoffsSchema.parse({
      baseVersionId,
      page: input.page,
      pageSize: CATALOG_HANDOFF_PAGE_SIZE,
      total: Number(count?.n ?? 0),
      items,
    });
  });
}
