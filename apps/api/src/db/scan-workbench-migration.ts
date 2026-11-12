import type { Database } from './mysql.ts';

export async function guardScanWorkbenchDown(db: Database): Promise<void> {
  const evidence = await db.get(`SELECT id FROM scan_facts WHERE source IS NOT NULL OR attribution IS NOT NULL
    OR revoked_at IS NOT NULL OR revoked_by IS NOT NULL LIMIT 1`);
  const duplicate = await db.get('SELECT barcode FROM scan_facts GROUP BY barcode HAVING COUNT(*)>1 LIMIT 1');
  if (evidence || duplicate) throw new Error('拒绝回退：清点记录已有来源、归属、撤销或跨单条码证据');
}
