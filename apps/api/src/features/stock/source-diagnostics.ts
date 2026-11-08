import type { Database } from '../../db/mysql.ts';
import { logger } from '../../shared/logger.ts';
import { unclassifiedStockCount } from './source-repository.ts';

const previousCounts = new WeakMap<Database, number>();

export async function reportUnclassifiedStock(db: Database): Promise<void> {
  const stockRows = await unclassifiedStockCount(db);
  const previous = previousCounts.get(db);
  previousCounts.set(db, stockRows);
  if (stockRows === 0 || stockRows === previous) return;
  logger.warn(
    { event: 'stock.unclassified_detected', stockRows, inventorySource: 'erp-product' },
    '未归属库存记录已排除用户库存视图；请诊断原始数据，不自动归类或合计',
  );
}
