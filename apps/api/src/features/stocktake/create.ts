import { randomUUID } from 'node:crypto';
import { createStocktakeSchema, stocktakeSchema, type CreateStocktake } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { activeMaster } from '../master-data/catalogs.ts';
import { assertWarehouseOpen, journalWatermark } from './window.ts';
import { getStocktake } from './read-model.ts';
import { isBlindHidden, publicHeader } from './visibility.ts';

async function capture(db: Database, id: string, input: CreateStocktake) {
  const codes = input.productCodes;
  if (codes) {
    const valid = await db.get(
      `SELECT COUNT(*) AS n FROM master_products WHERE inventory_eligible=1
      AND active=1 AND source_del_flag=0 AND code IN (${codes.map(() => '?').join(',')})`,
      codes,
    );
    ensure(Number(valid?.n) === codes.length, 'PRODUCT_NOT_INVENTORY', '盘点范围只能包含有库存资格的商品');
  }
  const filter = codes ? `p.code IN (${codes.map(() => '?').join(',')})` : 's.product_code IS NOT NULL';
  await db.run(
    `INSERT INTO stocktake_snapshots(stocktake_id,product_code,product_name,packages,weight_tonnes)
    SELECT ?,p.code,p.name,COALESCE(s.packages,0),COALESCE(s.weight_tonnes,0)
    FROM master_products p LEFT JOIN stock s ON s.product_code=p.code AND s.warehouse_code=? AND s.source_del_flag=0
    WHERE p.inventory_eligible=1 AND p.active=1 AND p.source_del_flag=0 AND ${filter}`,
    [id, input.warehouseCode, ...(codes ?? [])],
  );
  const rows = await db.all(
    'SELECT product_code,packages,weight_tonnes FROM stocktake_snapshots WHERE stocktake_id=? ORDER BY product_code',
    [id],
  );
  ensure(rows.length > 0, 'EMPTY_STOCKTAKE', '所选仓库暂无 商品库存；可指定商品生成零库存快照');
  await db.run('UPDATE stocktakes SET snapshot_hash=?,line_count=? WHERE id=?', [
    hash(JSON.stringify(rows)),
    rows.length,
    id,
  ]);
  await db.run(
    'INSERT INTO stocktake_readings(stocktake_id,product_code) SELECT stocktake_id,product_code FROM stocktake_snapshots WHERE stocktake_id=?',
    [id],
  );
}
async function insertHeader(db: Database, input: CreateStocktake, actor: Actor) {
  const id = randomUUID();
  const time = String((await db.get('SELECT UTC_TIMESTAMP(3) AS time'))?.time);
  const number = `PD-${time.slice(0, 10).replaceAll('-', '')}-${id.slice(0, 13).replaceAll('-', '').toUpperCase()}`;
  await db.run(
    `INSERT INTO stocktakes(id,number,warehouse_code,scope_kind,status,snapshot_at,journal_watermark,
    snapshot_hash,line_count,created_by,mode) VALUES(?,?,?,?,'counting',?,?,?,0,?,?)`,
    [
      id,
      number,
      input.warehouseCode,
      input.productCodes ? 'products' : 'warehouse',
      time,
      await journalWatermark(db, input.warehouseCode),
      '',
      actor.username,
      input.mode ?? 'open',
    ],
  );
  await db.run('INSERT INTO stocktake_windows(stocktake_id,warehouse_code,started_at) VALUES(?,?,?)', [
    id,
    input.warehouseCode,
    time,
  ]);
  return id;
}
export async function createStocktake(db: Database, input: CreateStocktake, key: string, actor: Actor) {
  const payload = createStocktakeSchema.parse(input);
  // Preserve the pre-024 idempotency fingerprint for default/explicit open creation.
  const { mode, ...legacyPayload } = payload;
  const intent = mode === 'open' ? legacyPayload : payload;
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const replay = await replayCommand(tx, 'stocktake.create', key, intent, actor, stocktakeSchema);
    if (replay) return replay;
    await activeMaster(tx, 'warehouses', payload.warehouseCode);
    await assertWarehouseOpen(tx, payload.warehouseCode);
    const id = await insertHeader(tx, payload, actor);
    await capture(tx, id, payload);
    const after = await getStocktake(tx, id);
    await audit(tx, actor, {
      action: 'stocktake.create',
      targetId: id,
      before: null,
      after: isBlindHidden(after) ? publicHeader(after) : after,
    });
    await saveCommand(tx, 'stocktake.create', key, intent, actor, after);
    return after;
  });
}
