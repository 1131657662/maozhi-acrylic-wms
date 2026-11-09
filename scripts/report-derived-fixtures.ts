import { randomUUID } from 'node:crypto';
import type { Database } from '../apps/api/src/db/mysql.ts';
import { reportMasters } from './report-fixtures.ts';

const tonnes = (grams: number) => (grams / 1_000_000).toFixed(4);
const utc = (local: string) => new Date(local.replace(' ', 'T') + '+08:00').toISOString().replace('T', ' ').slice(0, 23);

async function addReceipt(db: Database, code: string, warehouse: string, receipt: string) {
  const supplier = await db.get('SELECT code FROM master_suppliers ORDER BY code LIMIT 1');
  const id = `B3C-${receipt}`;
  await db.run(
    `INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,created_by,created_at,status,posting_state)
    VALUES(?,?,?,?,?,UTC_TIMESTAMP(3),'confirmed','confirmed')`,
    [id, id, String(supplier?.code ?? ''), warehouse, 'owner'],
  );
  await db.run('INSERT INTO inbound_lines(id,receipt_id,product_code,packages,weight_tonnes) VALUES(?,?,?,?,?)', [
    randomUUID(), id, code, 100, '1.0000',
  ]);
  return id;
}

async function addOrder(db: Database, warehouse: string, order: string) {
  const customer = await db.get('SELECT code FROM master_customers ORDER BY code LIMIT 1');
  const id = `B3C-${order}`;
  await db.run(
    `INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,status,revision,created_at)
    VALUES(?,?,?,?,?,?,'cancelled',0,UTC_TIMESTAMP(3))`,
    [id, id, 'B3c 补偿夹具', String(customer?.code ?? ''), warehouse, 'TEST'],
  );
  return id;
}

async function addEvent(
  db: Database,
  input: { warehouse: string; product: string; day: string; type: string; grams: number; before: number; target: string },
) {
  const operationId = randomUUID(),
    after = input.before + input.grams,
    createdAt = utc(input.day);
  await db.run(
    `INSERT INTO inventory_operations(id,operation_type,target_id,reason,actor,created_at) VALUES(?,?,?,?,?,?)`,
    [operationId, input.type, input.target, 'B3c 合成验收', 'owner', createdAt],
  );
  await db.run(
    `INSERT INTO stock_journal(operation_id,warehouse_code,product_code,packages_delta,tonnes_delta,created_at,
    source_del_flag,packages_before,packages_after,tonnes_before,tonnes_after)
    VALUES(?,?,?,?,?,?,0,?,?,?,?)`,
    [operationId, input.warehouse, input.product, 0, tonnes(input.grams), createdAt, 0, 0, tonnes(input.before), tonnes(after)],
  );
  return { operationId, after };
}

async function addClosure(
  db: Database,
  input: { kind: 'inbound' | 'outbound'; documentId: string; original: string; compensation: string },
) {
  await db.run(
    `INSERT INTO document_closures(id,${input.kind === 'inbound' ? 'inbound_receipt_id' : 'outbound_order_id'},action,reason,
    original_operation_id,compensation_operation_id,actor,created_at) VALUES(?,?,'reverse','B3c 合成补偿',?,?,?,UTC_TIMESTAMP(3))`,
    [randomUUID(), input.documentId, input.original, input.compensation, 'owner'],
  );
}

async function storeBalance(db: Database, warehouse: string, product: string, packages: number, grams: number) {
  await db.run(
    `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_row_json) VALUES(?,?,?,?,?)`,
    [warehouse, product, packages, tonnes(grams), JSON.stringify({ stock_qty: packages, stock_weight: tonnes(grams) })],
  );
}

async function seedDaily(db: Database) {
  const warehouse = 'B3C-WH', product = 'B3C-DAY';
  let before = 0;
  const rows = [
    ['2026-03-31 12:00:00', 'stock.adjust', 10_000_000, 'opening'],
    ['2026-04-02 12:00:00', 'inbound.confirm', 2_000_000, 'receipt'],
    ['2026-04-04 12:00:00', 'outbound.confirm', -4_000_000, 'order'],
    ['2026-04-05 12:00:00', 'stock.adjust', -1_000_000, 'adjust'],
    ['2026-04-06 12:00:00', 'stocktake.post', 1_000_000, 'count'],
  ] as const;
  for (const [day, type, grams, target] of rows) {
    const event = await addEvent(db, { warehouse, product, day, type, grams, before, target });
    before = event.after;
  }
  await storeBalance(db, warehouse, product, 0, before);
}

async function seedPartialFifo(db: Database) {
  const warehouse = 'B3C-WH', product = 'B3C-FIFO', receiptA = await addReceipt(db, product, warehouse, 'FIFO-A'),
    receiptB = await addReceipt(db, product, warehouse, 'FIFO-B'), order = await addOrder(db, warehouse, 'FIFO-OUT');
  let before = 0;
  const a = await addEvent(db, { warehouse, product, day: '2026-02-01 10:00:00', type: 'inbound.confirm', grams: 10_000_000, before, target: receiptA });
  before = a.after;
  const b = await addEvent(db, { warehouse, product, day: '2026-02-10 10:00:00', type: 'inbound.confirm', grams: 5_000_000, before, target: receiptB });
  before = b.after;
  const out = await addEvent(db, { warehouse, product, day: '2026-03-01 10:00:00', type: 'outbound.confirm', grams: -12_000_000, before, target: order });
  before = out.after;
  await storeBalance(db, warehouse, product, 0, before);
}

async function seedCompensation(db: Database) {
  const warehouse = 'B3C-WH', product = 'B3C-COMP', receiptA = await addReceipt(db, product, warehouse, 'COMP-A'),
    receiptB = await addReceipt(db, product, warehouse, 'COMP-B'), order = await addOrder(db, warehouse, 'COMP-OUT');
  let before = 0;
  const inA = await addEvent(db, { warehouse, product, day: '2026-02-01 10:00:00', type: 'inbound.confirm', grams: 10_000_000, before, target: receiptA });
  before = inA.after;
  const inB = await addEvent(db, { warehouse, product, day: '2026-02-10 10:00:00', type: 'inbound.confirm', grams: 5_000_000, before, target: receiptB });
  before = inB.after;
  const outbound = await addEvent(db, { warehouse, product, day: '2026-03-01 10:00:00', type: 'outbound.confirm', grams: -12_000_000, before, target: order });
  before = outbound.after;
  const outboundReverse = await addEvent(db, { warehouse, product, day: '2026-03-02 10:00:00', type: 'outbound.reverse', grams: 12_000_000, before, target: order });
  await addClosure(db, { kind: 'outbound', documentId: order, original: outbound.operationId, compensation: outboundReverse.operationId });
  before = outboundReverse.after;
  const inboundReverse = await addEvent(db, { warehouse, product, day: '2026-03-03 10:00:00', type: 'inbound.reverse', grams: -10_000_000, before, target: receiptA });
  await addClosure(db, { kind: 'inbound', documentId: receiptA, original: inA.operationId, compensation: inboundReverse.operationId });
  await storeBalance(db, warehouse, product, 0, inboundReverse.after);
}

async function seedNoOutbound(db: Database) {
  const warehouse = 'B3C-WH', product = 'B3C-NOOUT', opening = await addEvent(db, {
    warehouse, product, day: '2026-03-31 12:00:00', type: 'stock.adjust', grams: 5_000_000, before: 0, target: product,
  });
  await storeBalance(db, warehouse, product, 0, opening.after);
}

async function seedZeroClosing(db: Database) {
  const warehouse = 'B3C-WH', product = 'B3C-ZERO';
  let before = 0;
  for (const [day, type, grams] of [
    ['2026-04-07 12:00:00', 'stock.adjust', 0],
    ['2026-04-08 10:00:00', 'inbound.confirm', 2_000_000],
    ['2026-04-08 11:00:00', 'outbound.confirm', -2_000_000],
  ] as const) {
    const event = await addEvent(db, { warehouse, product, day, type, grams, before, target: product });
    before = event.after;
  }
  await storeBalance(db, warehouse, product, 0, before);
}

export async function seedB3cFixtures(db: Database) {
  await db.transaction(async (tx) => {
    await reportMasters(tx, 'B3C-WH');
    for (const product of ['B3C-DAY', 'B3C-FIFO', 'B3C-COMP', 'B3C-NOOUT', 'B3C-ZERO']) await reportMasters(tx, product);
    await seedDaily(tx);
    await seedPartialFifo(tx);
    await seedCompensation(tx);
    await seedNoOutbound(tx);
    await seedZeroClosing(tx);
  });
}
