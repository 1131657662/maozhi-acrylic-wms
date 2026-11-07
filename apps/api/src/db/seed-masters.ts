import type { Database } from './mysql.ts';
import { intValue, jsonRow, optional, readSampleCsv, required, type SampleRow } from './sample-reader.ts';

export async function seedMasters(db: Database, now: string): Promise<void> {
  await seedProducts(db, readSampleCsv('product'), now);
  await seedSimpleMaster(db, readSampleCsv('warehouse'), 'master_warehouses', 'warehouse_code', 'warehouse_name', now);
  await seedSimpleMaster(db, readSampleCsv('customer'), 'master_customers', 'customer_code', 'customer_name', now);
  await seedSimpleMaster(db, readSampleCsv('supplier'), 'master_suppliers', 'supplier_code', 'supplier_name', now);
}

async function seedProducts(db: Database, rows: SampleRow[], now: string): Promise<void> {
  for (const row of rows) {
    const deleted = intValue(row, 'del_flag');
    const created = optional(row, 'create_time') ?? now;
    const updated = optional(row, 'update_time') ?? created;
    await db.run(`INSERT INTO master_products
      (code,name,active,created_at,updated_at,source_kind,source_model,source_status,source_del_flag,source_row_json)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, [required(row, 'product_code'), required(row, 'product_name'), Number(deleted === 0),
      created, updated, 'erp-product', optional(row, 'product_model'), optional(row, 'status'), deleted, jsonRow(row)]);
  }
}

async function seedSimpleMaster(db: Database, rows: SampleRow[], table: string,
  codeField: string, nameField: string, now: string): Promise<void> {
  for (const row of rows) {
    const deleted = intValue(row, 'del_flag');
    const created = optional(row, 'create_time') ?? now;
    const updated = optional(row, 'update_time') ?? created;
    await db.run(`INSERT INTO ${table}
      (code,name,active,created_at,updated_at,source_del_flag,source_row_json)
      VALUES(?,?,?,?,?,?,?)`, [required(row, codeField), required(row, nameField), Number(deleted === 0),
      created, updated, deleted, jsonRow(row)]);
  }
}
