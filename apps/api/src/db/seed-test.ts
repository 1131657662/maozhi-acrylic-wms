import bcrypt from 'bcryptjs';
import type { Database } from './mysql.ts';
import { initializeCatalogV1 } from './catalog-bootstrap.ts';
import { decimalToGrams } from './weight.ts';
import type { CatalogEntry } from '../features/catalog/hash.ts';

export async function seedDemo(db: Database, password: string): Promise<void> {
  const masterV2 = Boolean(await db.get("SHOW COLUMNS FROM master_products LIKE 'inventory_eligible'"));
  const passwordHash = await bcrypt.hash(password, 4);
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO app_meta(meta_key,value) VALUES(?,?)', ['identity', 'maozhi-local-mysql8-v1']);
    await tx.run('INSERT INTO owner(username,password_hash) VALUES(?,?)', ['owner', passwordHash]);
    await tx.run(
      'INSERT INTO master_products(code,name,active,created_at,updated_at,source_kind,source_del_flag) VALUES(?,?,?,?,?,?,?)',
      ['ACR-032', '腈纶原料 · 合成样本', 1, '2026-11-07 00:00:00.000', '2026-11-07 00:00:00.000', 'erp-product', 0],
    );
    if (masterV2)
      await tx.run("UPDATE master_products SET origin_kind='legacy',inventory_eligible=1 WHERE code='ACR-032'");
    await tx.run(
      'INSERT INTO master_warehouses(code,name,active,created_at,updated_at,source_del_flag) VALUES(?,?,?,?,?,?)',
      ['DEMO-WH', '合成仓库', 1, '2026-11-07 00:00:00.000', '2026-11-07 00:00:00.000', 0],
    );
    await tx.run(
      'INSERT INTO master_suppliers(code,name,active,created_at,updated_at,source_del_flag) VALUES(?,?,?,?,?,?)',
      ['DEMO-SUPPLIER', '合成供应商', 1, '2026-11-07 00:00:00.000', '2026-11-07 00:00:00.000', 0],
    );
    for (let n = 1; n <= 3; n++)
      await tx.run(
        'INSERT INTO master_customers(code,name,active,created_at,updated_at,source_del_flag) VALUES(?,?,?,?,?,?)',
        [`DEMO-CUST-${n}`, `合成客户 ${n}`, 1, '2026-11-07 00:00:00.000', '2026-11-07 00:00:00.000', 0],
      );
    await tx.run(
      'INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_del_flag) VALUES(?,?,?,?,?)',
      ['DEMO-WH', 'ACR-032', 6, '1.8000', 0],
    );
    const entries: CatalogEntry[] = [];
    for (let n = 1; n <= 3; n++) entries.push(...(await seedPlan(tx, n)));
    await initializeCatalogV1(tx, entries);
  });
}

async function seedPlan(db: Database, n: number): Promise<CatalogEntry[]> {
  const id = `DEMO-00${n}`;
  await db.run(
    `INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,created_at,status,source_del_flag)
    VALUES(?,?,?,?,?,?,?,?,?)`,
    [
      id,
      `DEMO-OUT-20261107-00${n}`,
      `合成客户 ${n}`,
      `DEMO-CUST-${n}`,
      'DEMO-WH',
      `测试车辆 ${n}`,
      '2026-11-07 00:00:00.000',
      'open',
      0,
    ],
  );
  await db.run(
    `INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,source_del_flag)
    VALUES(?,?,?,?,?,?,?)`,
    [`${id}-L1`, id, 'ACR-032', '腈纶原料 · 合成样本', 2, '0.6000', 0],
  );
  const weights = [
    ['0.3025', '0.2975'],
    ['0.2800', '0.3200'],
    ['0.3100', '0.2900'],
  ][n - 1]!;
  return weights.map((weight, index) => ({
    barcode: `DEMO-032-${n}${index + 1}`,
    legacyProductCode: 'ACR-032',
    sourceSpec: '合成规格',
    rawWeightKg: String(decimalToGrams(weight) / 1000),
    weightGrams: decimalToGrams(weight),
  }));
}
