import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';

// Caller holds the inventory writer lock; this is a persisted business pause, not a long-lived DB lock.
export async function assertWarehouseOpen(db: Database, warehouse: string): Promise<void> {
  const window = await db.get(
    `SELECT t.id,t.number FROM stocktake_windows w JOIN stocktakes t ON t.id=w.stocktake_id
    WHERE w.active_warehouse=?`,
    [warehouse],
  );
  ensure(
    !window,
    'WAREHOUSE_STOCKTAKE_PAUSED',
    `该仓库正在盘点 ${window?.number}，暂停确认、调整与撤销。请从“进行中盘点”进入 /stocktakes/${window?.id} 处理。`,
  );
}
export async function journalWatermark(db: Database, warehouse: string): Promise<number> {
  return Number(
    (
      await db.get('SELECT COALESCE(MAX(id),0) AS n FROM stock_journal WHERE warehouse_code=? AND source_del_flag=0', [
        warehouse,
      ])
    )?.n,
  );
}
export async function lockCounting(db: Database, id: string) {
  const row = await db.get('SELECT * FROM stocktakes WHERE id=? FOR UPDATE', [id]);
  ensure(row, 'STOCKTAKE_NOT_FOUND', '盘点单不存在');
  ensure(row.status === 'counting', 'STOCKTAKE_CLOSED', '盘点已完成或作废，不能重新录入或回写');
  const window = await db.get('SELECT stocktake_id FROM stocktake_windows WHERE active_warehouse=?', [
    String(row.warehouse_code),
  ]);
  ensure(window?.stocktake_id === id, 'STOCKTAKE_WINDOW_LOST', '暂停窗口归属异常，请保留现场并联系维护');
  return row;
}
