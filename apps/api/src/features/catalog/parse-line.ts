import { gramsSchema, idSchema } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import type { CatalogEntry } from './hash.ts';

export function invalidCatalogLine(line: number, message: string): never {
  throw new AppError('CATALOG_FILE_INVALID', `第 ${line} 行：${message}`, 422);
}
export function parseCatalogLine(line: string, lineNo: number): CatalogEntry {
  const match = /^\s*(\S(?:.*?\S)?)\s+([A-Za-z0-9_-]+)\s+(\S+)\s*$/.exec(line);
  if (!match) invalidCatalogLine(lineNo, '缺少规格、条码或重量');
  const [, spec, barcode, kg] = match;
  if (!spec || spec.length > 255 || !barcode || !idSchema.safeParse(barcode).success)
    invalidCatalogLine(lineNo, '规格或条码不合法');
  if (!kg || !/^\d+(?:\.\d+)?$/.test(kg)) invalidCatalogLine(lineNo, '重量必须为正十进制 kg');
  if (kg.length > 64) invalidCatalogLine(lineNo, '原始重量文本不能超过 64 个字符');
  const [whole, fraction = ''] = kg.split('.');
  if (/[1-9]/.test(fraction.slice(1))) invalidCatalogLine(lineNo, '重量必须能精确到 0.1kg，禁止舍入');
  const grams = BigInt(whole!) * 1000n + BigInt(fraction.slice(0, 1) || '0') * 100n;
  const weight = Number(grams);
  if (!gramsSchema.safeParse(weight).success) invalidCatalogLine(lineNo, '重量为零、负数或超出支持范围');
  return { barcode, sourceSpec: spec, rawWeightKg: kg, weightGrams: weight, legacyProductCode: null };
}
