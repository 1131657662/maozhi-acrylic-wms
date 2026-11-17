import { MESSAGES } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { messageSelect } from './source-documents.ts';

export async function backupSources(db: Database, now: Date) {
  const at = sqlDate(now.toISOString());
  return db.all(
    `WITH success AS (SELECT MAX(finished_at) AS at FROM maintenance_jobs
      WHERE kind='backup' AND status='succeeded' AND finished_at<=?)
    ${messageSelect} 'backup' AS object_type,j.id,'' AS name,COALESCE(j.finished_at,j.started_at) AS anchor
    FROM maintenance_jobs j CROSS JOIN success s
    WHERE j.kind='backup' AND j.status IN ('failed','interrupted')
      AND COALESCE(j.finished_at,j.started_at)>COALESCE(s.at,'1000-01-01') AND COALESCE(j.finished_at,j.started_at)<=?
    UNION ALL SELECT 'schedule',r.id,'',r.ran_at FROM scheduler_runs r CROSS JOIN success s
    WHERE r.kind='backup' AND r.status IN ('failed','interrupted') AND r.ran_at>COALESCE(s.at,'1000-01-01')
      AND r.ran_at<=? AND (JSON_EXTRACT(r.detail,'$.jobId') IS NULL OR JSON_TYPE(JSON_EXTRACT(r.detail,'$.jobId'))='NULL')`,
    [at, at, at],
  );
}
export async function anomalySources(db: Database) {
  return db.all(
    `WITH differences AS (
    SELECT s.stocktake_id FROM stocktake_snapshots s JOIN stocktake_readings r USING(stocktake_id,product_code)
    WHERE r.packages IS NOT NULL AND ABS(r.packages-s.packages)>GREATEST(s.packages*?,?)
    UNION SELECT stocktake_id FROM stocktake_discovery_lines WHERE packages>?
  ) ${messageSelect} 'stock' AS object_type,CAST(JSON_ARRAY(warehouse_code,product_code) AS CHAR) AS id,
    '' AS name,'negative' AS anchor FROM stock WHERE source_del_flag=0 AND (packages<0 OR weight_tonnes<0)
    UNION ALL SELECT 'stocktake',t.id,t.number,t.snapshot_at FROM stocktakes t
    JOIN differences d ON d.stocktake_id=t.id
    WHERE t.status='counting' AND (t.mode='open' OR t.revealed_at IS NOT NULL)`,
    [MESSAGES.differenceRatio, MESSAGES.differencePackages, MESSAGES.differencePackages],
  );
}
