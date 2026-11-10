import { randomUUID } from 'node:crypto';
import type { Database } from '../apps/api/src/db/mysql.ts';

interface Movement {
  day: string;
  type: string;
  q: number;
  g: number;
  legacy?: boolean;
  deleted?: boolean;
}
const movements: Movement[] = [
  { day: '2025-12-31 12:00:00', type: 'import', q: 100, g: 30_000_000, legacy: true },
  { day: '2026-01-05 23:45:00', type: 'inbound', q: 20, g: 6_100_000, legacy: true },
  { day: '2026-01-25 10:00:00', type: 'outbound', q: -5, g: -1_450_000, legacy: true },
  { day: '2026-02-03 10:00:00', type: 'check', q: 2, g: 610_000, legacy: true },
  { day: '2026-02-12 10:00:00', type: 'inbound', q: 8, g: 2_390_000, legacy: true },
  { day: '2026-02-18 10:00:00', type: 'outbound', q: -4, g: -1_180_000, legacy: true },
  { day: '2026-03-01 00:05:00', type: 'inbound.reverse', q: -8, g: -2_390_000 },
  { day: '2026-03-02 10:00:00', type: 'outbound.reverse', q: 4, g: 1_180_000 },
  { day: '2026-03-12 10:00:00', type: 'stock.adjust', q: -1, g: -300_000 },
  { day: '2026-03-20 10:00:00', type: 'inbound.confirm', q: 7, g: 2_130_000 },
  { day: '2026-03-26 10:00:00', type: 'outbound.confirm', q: -3, g: -920_000 },
  { day: '2026-03-28 10:00:00', type: 'stocktake.post', q: 0, g: 1_000 },
];
const tonnes = (grams: number) => (grams / 1_000_000).toFixed(4);
export async function reportMasters(db: Database, code: string): Promise<void> {
  await db.run(
    `INSERT IGNORE INTO master_warehouses(code,name,active,created_at,updated_at) VALUES(?,?,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
    [code, `报表合成仓 ${code}`],
  );
  await db.run(
    `INSERT IGNORE INTO master_products(code,name,source_kind,active,created_at,updated_at,origin_kind,inventory_eligible) VALUES(?,?,'erp-product',1,UTC_TIMESTAMP(),UTC_TIMESTAMP(),'legacy',1)`,
    [code, `报表合成商品 ${code}`],
  );
}
async function addMovement(db: Database, wh: string, product: string, m: Movement, before: { q: number; g: number }) {
  const after = { q: before.q + m.q, g: before.g + m.g },
    operation = m.legacy ? null : randomUUID();
  const utc = new Date(m.day.replace(' ', 'T') + '+08:00').toISOString().replace('T', ' ').slice(0, 23);
  if (operation)
    await db.run(
      `INSERT INTO inventory_operations(id,operation_type,target_id,reason,actor,created_at) VALUES(?,?,?,?,?,?)`,
      [operation, m.type, product, '合成报表验收', 'owner', utc],
    );
  const source = m.legacy
    ? JSON.stringify({
        create_time: m.day,
        before_qty: before.q,
        after_qty: after.q,
        before_weight: tonnes(before.g),
        after_weight: tonnes(after.g),
      })
    : null;
  await db.run(
    `INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,
    source_id,source_business_type,source_del_flag,source_row_json,operation_id,packages_before,packages_after,tonnes_before,tonnes_after)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      wh,
      product,
      m.q,
      tonnes(m.g),
      m.legacy ? m.day : utc,
      m.legacy ? randomUUID() : null,
      m.legacy ? m.type : null,
      m.deleted ? 1 : 0,
      source,
      operation,
      before.q,
      after.q,
      tonnes(before.g),
      tonnes(after.g),
    ],
  );
  return after;
}
export async function seedReportEvidence(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    for (const code of ['RPT-W1', 'RPT-W2', 'RPT-P1', 'RPT-P2', 'RPT-P3', 'RPT-GAP']) await reportMasters(tx, code);
    for (const wh of ['RPT-W1', 'RPT-W2'])
      for (const product of ['RPT-P1', 'RPT-P2', 'RPT-P3']) await seedCell(tx, wh, product);
    await addMovement(
      tx,
      'RPT-W1',
      'RPT-GAP',
      { day: '2025-12-31 12:00:00', type: 'import', q: 10, g: 3_000_000, legacy: true },
      { q: 0, g: 0 },
    );
    await addMovement(
      tx,
      'RPT-W1',
      'RPT-GAP',
      { day: '2026-03-05 12:00:00', type: 'inbound', q: 1, g: 300_000, legacy: true },
      { q: 11, g: 3_300_000 },
    );
    await tx.run(
      `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_row_json) VALUES('RPT-W1','RPT-GAP',12,'3.6000',?)`,
      [JSON.stringify({ stock_qty: 12, stock_weight: '3.6000' })],
    );
  });
}
async function seedCell(db: Database, wh: string, product: string): Promise<void> {
  let balance = { q: 0, g: 0 },
    legacy = { q: 0, g: 0 };
  for (const m of movements) {
    balance = await addMovement(db, wh, product, m, balance);
    if (m.legacy) legacy = { ...balance };
  }
  await addMovement(
    db,
    wh,
    product,
    { day: '2026-01-31 23:59:00', type: 'inbound', q: 99, g: 29_700_000, legacy: true, deleted: true },
    balance,
  );
  await db.run(
    `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_row_json) VALUES(?,?,?,?,?)`,
    [
      wh,
      product,
      balance.q,
      tonnes(balance.g),
      JSON.stringify({ stock_qty: legacy.q, stock_weight: tonnes(legacy.g) }),
    ],
  );
}
