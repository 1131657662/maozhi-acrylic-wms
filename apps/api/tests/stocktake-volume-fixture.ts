import type { Database } from '../src/db/mysql.ts';

export async function seedStocktakeVolume(db: Database, count = 10000) {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  if (!/^maozhi_test_[a-f0-9]{24}$/.test(name)) throw new Error('Synthetic volume fixture requires disposable DB');
  await db.run(
    "INSERT INTO master_warehouses(code,name,created_at,updated_at) VALUES('COUNT-WH','万行盘点验收仓',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
  );
  for (let offset = 0; offset < count; offset += 500) {
    const codes = Array.from(
      { length: Math.min(500, count - offset) },
      (_, i) => `COUNT-${String(offset + i + 1).padStart(5, '0')}`,
    );
    await db.run(
      `INSERT INTO master_products(code,name,source_kind,created_at,updated_at) VALUES
      ${codes.map(() => "(?,?,'erp-product',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))").join(',')}`,
      codes.flatMap((c) => [c, `合成盘点商品 ${c}`]),
    );
    await db.run(
      `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES
      ${codes.map(() => "('COUNT-WH',?,2,'0.6000')").join(',')}`,
      codes,
    );
  }
}
