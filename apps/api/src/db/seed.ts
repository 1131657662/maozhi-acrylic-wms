import type { Database } from './mysql.ts';
import bcrypt from 'bcryptjs';

export async function seedDemo(db: Database, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO app_meta(meta_key,value) VALUES(?,?)', ['identity', 'maozhi-local-mysql8-v1']);
    await tx.run('INSERT INTO owner(username,password_hash) VALUES(?,?)', ['owner', passwordHash]);
    await seedMasters(tx);
    await tx.run('INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES(?,?,?,?)',
      ['DEMO-WH', 'ACR-032', 6, '1.8000']);
    for (let n = 1; n <= 3; n++) await seedPlan(tx, n);
  });
}
async function seedMasters(db: Database): Promise<void> {
  await db.run('INSERT INTO master_products(code,name,active,created_at,updated_at) VALUES(?,?,?,?,?)',
    ['ACR-032', '腈纶原料 · 合成样本', 1, '2026-11-07 00:00:00.000', '2026-11-07 00:00:00.000']);
  await db.run('INSERT INTO master_warehouses(code,name,active,created_at,updated_at) VALUES(?,?,?,?,?)',
    ['DEMO-WH', '合成仓库', 1, '2026-11-07 00:00:00.000', '2026-11-07 00:00:00.000']);
  await db.run('INSERT INTO master_suppliers(code,name,active,created_at,updated_at) VALUES(?,?,?,?,?)',
    ['DEMO-SUPPLIER', '合成供应商', 1, '2026-11-07 00:00:00.000', '2026-11-07 00:00:00.000']);
  for (let n = 1; n <= 3; n++) await db.run(
    'INSERT INTO master_customers(code,name,active,created_at,updated_at) VALUES(?,?,?,?,?)',
    [`DEMO-CUST-${n}`, `合成客户 ${n}`, 1, '2026-11-07 00:00:00.000', '2026-11-07 00:00:00.000']);
}
async function seedPlan(db: Database, n: number): Promise<void> {
  const id = `DEMO-00${n}`;
  await db.run(`INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,created_at)
    VALUES(?,?,?,?,?,?,?)`, [id,`DEMO-OUT-20261107-00${n}`,`合成客户 ${n}`,`DEMO-CUST-${n}`,'DEMO-WH',`演示车辆 ${n}`,'2026-11-07 00:00:00.000']);
  await db.run(`INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes)
    VALUES(?,?,?,?,?,?)`, [`${id}-L1`,id,'ACR-032','腈纶原料 · 合成样本',2,'0.6000']);
  const weights = [['0.3025','0.2975'],['0.2800','0.3200'],['0.3100','0.2900']][n-1]!;
  for (const [index, weight] of weights.entries())
    await db.run('INSERT INTO scan_catalog(barcode,product_code,weight_tonnes,catalog_version) VALUES(?,?,?,?)',
      [`DEMO-032-${n}${index+1}`,'ACR-032',weight,1]);
}
