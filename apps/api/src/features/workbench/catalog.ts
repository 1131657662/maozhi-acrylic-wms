import { WORKBENCH, catalogDiffCountsSchema, type WorkbenchPeriod } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { metric, select } from './metrics.ts';

export async function dashboardCatalog(db: Database, period: WorkbenchPeriod) {
  const row = await db.get(`${select} v.version_id,v.entry_count,v.published_at,v.diff_json
    FROM catalog_head h JOIN catalog_versions v ON v.version_id=h.active_version_id WHERE h.id=1`);
  if (!row) return null;
  const diff = catalogDiffCountsSchema.parse(
    typeof row.diff_json === 'string' ? JSON.parse(row.diff_json) : row.diff_json,
  );
  const publishedAt = row.published_at ? isoDate(row.published_at) : null;
  const current = { from: publishedAt ?? period.to, to: period.to };
  return {
    version: Number(row.version_id),
    publishedAt,
    expired:
      !!publishedAt && Date.parse(period.to) - Date.parse(publishedAt) >= WORKBENCH.catalogDays * WORKBENCH.dayMs,
    entries: metric(Number(row.entry_count), '条', current),
    added: metric(diff.added, '条', current),
    removed: metric(diff.removed, '条', current),
    weight: metric(diff.weight, '条', current),
  };
}
