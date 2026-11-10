import type { Database } from '../apps/api/src/db/mysql.ts';
import { addV1Fixture } from '../apps/api/tests/catalog-fixture.ts';

// Disposable adversarial fixtures: non-ERP stock is invalid business data used to prove exclusion.
// Never creates inventory in the sample development database.
export async function seedSourceEvidence(db: Database): Promise<void> {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  if (!/^maozhi_test_[a-f0-9]{24}$/.test(name)) throw new Error('Source fixtures require a disposable test database');
  await addProductStock(db, { code: 'SRC-ERP-A', source: 'erp-product', packages: 7, tonnes: '2.1175' });
  await addProductStock(db, { code: 'SPEC-LOOKALIKE', source: 'erp-product', packages: 11, tonnes: '3.3285' });
  await addProductStock(db, { code: 'SRC-SPEC-A', source: 'sku-spec', packages: 13, tonnes: '3.9130' });
  await addProductStock(db, { code: 'ERP-LOOKALIKE', source: 'sku-spec', packages: 17, tonnes: '5.2310' });
  await addProductStock(db, { code: 'SRC-LOCAL', source: 'app', packages: 3, tonnes: '0.9300' });
  await db.run(`INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes)
    VALUES('DEMO-WH','SRC-MISSING',2,'0.6100')`);
  await db.run(`INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_del_flag)
    VALUES('DEMO-WH','SRC-ERP-A',999,'299.7000',1)`);
  await db.run(`INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,source_del_flag)
    VALUES('DEMO-WH','SRC-ERP-A',999,'299.7000',UTC_TIMESTAMP(3),1)`);
  await addV1Fixture(db, { barcode: 'SRC-CATALOG-ONLY', product: 'SRC-SPEC-A', tonnes: '0.3895' });
}
interface ProductStock {
  code: string;
  source: string;
  packages: number;
  tonnes: string;
}
async function addProductStock(db: Database, row: ProductStock): Promise<void> {
  await db.run(
    `INSERT INTO master_products(code,name,active,created_at,updated_at,source_kind,origin_kind,inventory_eligible)
    VALUES(?,'同名验收商品',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),?,?,?)`,
    [row.code, row.source, row.source === 'erp-product' ? 'legacy' : 'unknown', Number(row.source === 'erp-product')],
  );
  await db.run(
    `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes)
    VALUES('DEMO-WH',?,?,?)`,
    [row.code, row.packages, row.tonnes],
  );
  await db.run(
    `INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,source_business_type)
    VALUES('DEMO-WH',?,1,'0.3000',UTC_TIMESTAMP(3),'source_fixture')`,
    [row.code],
  );
}
