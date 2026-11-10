import { stocktakePreviewSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { hash } from '../../shared/hash.ts';
import { getStocktake } from './read-model.ts';
import { unpostedDocuments } from './unposted.ts';
import { journalWatermark } from './window.ts';

export async function balanceMismatches(db: Database, id: string, warehouse: string): Promise<number> {
  const row = await db.get(
    `SELECT COUNT(*) AS n FROM stocktake_snapshots s
    LEFT JOIN stock b ON b.warehouse_code=? AND b.product_code=s.product_code AND b.source_del_flag=0
    WHERE s.stocktake_id=? AND (s.packages<>COALESCE(b.packages,0) OR s.weight_tonnes<>COALESCE(b.weight_tonnes,0))`,
    [warehouse, id],
  );
  return Number(row?.n ?? 0);
}
export async function stocktakePreview(db: Database, id: string) {
  const take = await getStocktake(db, id),
    unposted = await unpostedDocuments(db, take);
  const watermark = await journalWatermark(db, take.warehouseCode);
  const original = await db.get('SELECT journal_watermark FROM stocktakes WHERE id=?', [id]);
  const mismatch = await balanceMismatches(db, id, take.warehouseCode),
    blockers: { code: string; message: string }[] = [];
  const extra =
    take.scope === 'warehouse'
      ? Number(
          (
            await db.get(
              `SELECT COUNT(*) AS n FROM stock b
    JOIN master_products p ON p.code=b.product_code AND p.inventory_eligible=1 AND p.source_del_flag=0
    WHERE b.warehouse_code=? AND b.source_del_flag=0 AND NOT EXISTS(SELECT 1 FROM stocktake_snapshots s
      WHERE s.stocktake_id=? AND s.product_code=b.product_code)`,
              [take.warehouseCode, id],
            )
          )?.n,
        )
      : 0;
  if (take.status !== 'counting') blockers.push({ code: 'STOCKTAKE_CLOSED', message: '盘点已终结，不能再次回写' });
  if (take.recordedCount !== take.lineCount)
    blockers.push({
      code: 'STOCKTAKE_INCOMPLETE',
      message: `还有 ${take.lineCount - take.recordedCount} 行未录入；未录不等于零`,
    });
  if (watermark !== Number(original?.journal_watermark) || mismatch || extra)
    blockers.push({
      code: 'STOCKTAKE_STOCK_DRIFT',
      message: '暂停期间库存或流水被外部修改，禁止覆盖；请保全记录并核对',
    });
  const result = { stocktake: take, unposted, blockers };
  return stocktakePreviewSchema.parse({
    ...result,
    token: hash(JSON.stringify({ ...result, watermark, mismatch, extra })),
  });
}
