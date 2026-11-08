import type { Database } from './mysql.ts';
import { readSkuFile } from './sample-reader.ts';
import { initializeCatalogV1 } from './catalog-bootstrap.ts';
import { decimalToGrams } from './weight.ts';

export function kilogramsToTonnes(value: string): string {
  const match = /^(\d+)(?:\.(\d))?$/.exec(value);
  if (!match) throw new Error(`sku.txt 重量不是支持的十进制 kg: ${value}`);
  const scaled = BigInt(match[1]!) * 10n + BigInt(match[2] ?? '0');
  return `${scaled / 10000n}.${(scaled % 10000n).toString().padStart(4, '0')}`;
}

export async function seedScanCatalog(db: Database, now: string): Promise<void> {
  const rows = readSkuFile();
  const specifications = [...new Set(rows.map((row) => row.spec))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const codes = new Map(specifications.map((spec, index) => [spec, `SPEC-${String(index + 1).padStart(3, '0')}`]));
  for (const [spec, code] of codes) {
    await db.run(`INSERT INTO master_products
      (code,name,active,created_at,updated_at,source_kind,source_model,source_status,source_del_flag,source_row_json)
      VALUES(?,?,?,?,?,?,?,?,?,?)`, [code, spec, 1, now, now, 'sku-spec', spec, 'authoritative', 0,
      JSON.stringify({ source: 'sku.txt', specification: spec })]);
  }
  const entries=rows.map((row)=>{
    const productCode = codes.get(row.spec);
    if (!productCode) throw new Error(`规格未生成商品编码: ${row.spec}`);
    return {barcode:row.barcode,sourceSpec:row.spec,rawWeightKg:row.weightKg,
      weightGrams:decimalToGrams(kilogramsToTonnes(row.weightKg)),legacyProductCode:productCode};
  });
  await initializeCatalogV1(db,entries);
}
