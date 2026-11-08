import type { Database } from '../apps/api/src/db/mysql.ts';

async function insertBatch(db: Database, sql: string, rows: (string | number | null)[][]): Promise<void> {
  const placeholders = rows.map((row) => '(' + row.map(() => '?').join(',') + ')').join(',');
  await db.run(sql + ' VALUES ' + placeholders, rows.flat());
}
async function seedBatch(db: Database, start: number, count: number): Promise<void> {
  const numbers = Array.from({ length: count }, (_, offset) => String(start + offset).padStart(6, '0'));
  const date = '2026-11-01 16:00:00.000';
  await insertBatch(
    db,
    'INSERT INTO master_products(code,name,active,source_kind,created_at,updated_at)',
    numbers.map((n) => ['WL-P' + n, '列表验收腈纶长规格名称 ' + n, 1, 'erp-product', date, date]),
  );
  await insertBatch(
    db,
    'INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes)',
    numbers.map((n) => ['DEMO-WH', 'WL-P' + n, 2, '0.6000']),
  );
  await insertBatch(
    db,
    'INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,created_by,created_at,status,posting_state)',
    numbers.map((n) => [
      'WL-R' + n,
      'WL-RK-' + n,
      'DEMO-SUPPLIER',
      'DEMO-WH',
      'owner',
      date,
      Number(n) === 0 ? null : Number(n) % 3 === 0 ? 'legacy-code' : 'pending',
      'pending',
    ]),
  );
  await insertBatch(
    db,
    'INSERT INTO inbound_lines(id,receipt_id,product_code,packages,weight_tonnes,source_del_flag)',
    numbers.flatMap((n) => [
      [n + '-R1', 'WL-R' + n, 'WL-P' + n, 1, '0.3025', 0],
      [n + '-R2', 'WL-R' + n, 'WL-P' + n, 1, '0.2975', 0],
      [n + '-RD', 'WL-R' + n, 'WL-P' + n, 9, '2.7000', 1],
    ]),
  );
  await insertBatch(
    db,
    'INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,status,created_at)',
    numbers.map((n) => [
      'WL-O' + n,
      'WL-CK-' + n,
      '列表验收客户 ' + n,
      'DEMO-CUST-1',
      'DEMO-WH',
      'WL-车牌-' + n,
      Number(n) % 3 === 0 ? 'legacy-code' : 'open',
      date,
    ]),
  );
  await insertBatch(
    db,
    'INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,source_del_flag)',
    numbers.flatMap((n) => [
      [n + '-O1', 'WL-O' + n, 'WL-P' + n, '列表验收商品', 1, '0.3025', 0],
      [n + '-O2', 'WL-O' + n, 'WL-P' + n, '列表验收商品', 1, '0.2975', 0],
      [n + '-OD', 'WL-O' + n, 'WL-P' + n, '已软删明细', 9, '2.7000', 1],
    ]),
  );
  await insertBatch(
    db,
    'INSERT INTO operation_log(action,target_id,actor,trace_id,before_json,after_json,created_at)',
    numbers.map((n) => [
      'list.fixture',
      'WL-R' + n,
      'owner',
      'WL-TRACE-' + n,
      '{"packages":1}',
      '{"packages":2}',
      date,
    ]),
  );
}
export async function seedListEvidence(db: Database, count = 240): Promise<void> {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  if (!/^maozhi_test_[a-f0-9]{24}$/.test(name)) throw new Error('列表夹具仅允许写入随机临时测试库');
  if (await db.get("SELECT code FROM master_products WHERE code='WL-P000000'")) return;
  for (let start = 0; start < count; start += 500) await seedBatch(db, start, Math.min(500, count - start));
}
