import type { FactInput, ScanContextInput } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { gramsToDecimal, decimalToGrams } from '../../db/weight.ts';
import { sqlDate } from '../../db/dates.ts';

export interface ResolvedContext extends ScanContextInput {
  productCode: string;
  bindingSource: string;
}
export async function resolveContext(
  db: Database,
  input: { planId: string; fact: FactInput; context?: ScanContextInput },
): Promise<ResolvedContext> {
  const { planId, fact } = input;
  const row = await db.get(
    `SELECT e.*,v.status FROM catalog_versions v LEFT JOIN catalog_entries e ON v.version_id=e.version_id AND e.barcode=?
    WHERE v.version_id=?`,
    [fact.barcode, fact.catalogVersion],
  );
  ensure(row && row.status === 'published', 'CATALOG_VERSION_UNAVAILABLE', '所声明版本未发布或不存在');
  ensure(row.barcode, 'UNKNOWN_BARCODE', '条码不在所声明的历史目录版本中');
  ensure(decimalToGrams(row.weight_tonnes) === fact.weightGrams, 'WEIGHT_MISMATCH', '实重与所声明的历史目录版本不一致');
  const spec = row.source_spec === null ? null : String(row.source_spec);
  const context = input.context ?? (await legacyContext(db, { planId, product: row.legacy_product_code, spec }));
  ensure(context.sourceSpec === spec, 'FACT_CONTEXT_MISMATCH', '规格与所声明的历史目录版本不一致');
  const line = await db.get(
    `SELECT l.product_code,p.inventory_eligible FROM outbound_lines l JOIN master_products p ON p.code=l.product_code
    WHERE l.id=? AND l.order_id=? AND l.source_del_flag=0`,
    [context.outboundLineId, planId],
  );
  ensure(
    line && Number(line.inventory_eligible) === 1,
    'FACT_CONTEXT_MISMATCH',
    '必须选择原单内的有库存资格的商品作业行',
  );
  return {
    ...context,
    productCode: String(line.product_code),
    bindingSource: input.context ? 'explicit-line' : 'legacy-exact',
  };
}
async function legacyContext(
  db: Database,
  input: { planId: string; product: unknown; spec: string | null },
): Promise<ScanContextInput> {
  const lines = await db.all(
    `SELECT l.id FROM outbound_lines l JOIN master_products p ON p.code=l.product_code
    WHERE l.order_id=? AND l.product_code=? AND l.source_del_flag=0 AND p.inventory_eligible=1`,
    [input.planId, String(input.product ?? '')],
  );
  ensure(lines.length === 1, 'FACT_CONTEXT_REQUIRED', '旧事实缺少可靠 ERP 作业行，请保留原记录并完成设备交接');
  return { outboundLineId: String(lines[0]!.id), sourceSpec: input.spec, resolvedAt: null };
}
export function contextHash(context: ScanContextInput): string {
  return hash(
    JSON.stringify({
      outboundLineId: context.outboundLineId,
      sourceSpec: context.sourceSpec,
      resolvedAt: context.resolvedAt,
    }),
  );
}
export async function saveFactContext(db: Database, fact: FactInput, context: ResolvedContext): Promise<void> {
  await db.run(
    `INSERT INTO scan_fact_context(fact_id,catalog_version_id,barcode,outbound_line_id,erp_product_code,source_spec,weight_tonnes,resolved_at,binding_source,context_hash)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      fact.id,
      fact.catalogVersion,
      fact.barcode,
      context.outboundLineId,
      context.productCode,
      context.sourceSpec,
      gramsToDecimal(fact.weightGrams),
      context.resolvedAt ? sqlDate(context.resolvedAt) : null,
      context.bindingSource,
      contextHash(context),
    ],
  );
}
