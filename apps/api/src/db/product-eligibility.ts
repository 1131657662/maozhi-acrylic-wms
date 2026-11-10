import type { Database } from './mysql.ts';
import { masterReferences } from '../features/master-data/references.ts';

export async function productEligibilityReport(db: Database) {
  const products = await db.all('SELECT code,name,source_kind FROM master_products ORDER BY code');
  const decisions = [];
  for (const product of products) {
    const code = String(product.code),
      sourceKind = String(product.source_kind);
    const stockRows = Number((await db.get('SELECT COUNT(*) AS n FROM stock WHERE product_code=?', [code]))?.n);
    const references = await masterReferences(db, 'products', code);
    let originKind = 'unknown',
      eligible = false,
      reason = '未知来源，禁止自动授予库存资格';
    if (sourceKind === 'erp-product') {
      originKind = 'legacy';
      eligible = true;
      reason = '已核验历史ERP商品，固定映射';
    } else if (sourceKind === 'sku-spec') {
      reason = '条码规格目录，永不具备库存资格';
    } else if (sourceKind === 'app') {
      if (stockRows === 0 && references.length === 0) {
        originKind = 'local';
        eligible = true;
        reason = 'app无库存行且无进行中引用';
      } else reason = `app待用户确认：库存行${stockRows}，进行中引用${references.length}`;
    }
    decisions.push({
      code,
      name: String(product.name),
      sourceKind,
      originKind,
      eligible,
      reason,
      stockRows,
      references,
    });
  }
  return {
    total: decisions.length,
    eligible: decisions.filter((row) => row.eligible).length,
    notEligible: decisions.filter((row) => !row.eligible).length,
    decisions,
  };
}
export async function migrateProductEligibility(db: Database): Promise<void> {
  // migrateUp owns a dedicated connection (not Database.transaction's pool wrapper).
  await db.run('START TRANSACTION');
  try {
    await db.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    const report = await productEligibilityReport(db);
    const tx = db;
    for (const row of report.decisions) {
      await tx.run('UPDATE master_products SET origin_kind=?,inventory_eligible=?,model=source_model WHERE code=?', [
        row.originKind,
        Number(row.eligible),
        row.code,
      ]);
      await tx.run(
        `INSERT INTO product_eligibility_migration(product_code,source_kind,origin_kind,inventory_eligible,reason,evidence_json)
        VALUES(?,?,?,?,?,?)`,
        [row.code, row.sourceKind, row.originKind, Number(row.eligible), row.reason, JSON.stringify(row)],
      );
    }
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}
