import { gramsSchema, idSchema } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import type { CatalogEntry } from './hash.ts';

export function parseCatalog(bytes: Buffer, encoding: string): CatalogEntry[] {
  if (bytes.length > 5 * 1024 * 1024) throw new AppError('CATALOG_FILE_TOO_LARGE', '文件不能超过 5 MiB', 413);
  if (!['utf-8', 'gb18030'].includes(encoding))
    throw new AppError('CATALOG_ENCODING_UNSUPPORTED', '请选择 UTF-8 或 GB18030 编码', 415);
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new AppError('CATALOG_FILE_INVALID', '文件编码无法完整解码，请核对所选编码', 422);
  }
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const entries: CatalogEntry[] = [];
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const entry = parseLine(line, index + 1);
    if (seen.has(entry.barcode)) invalid(index + 1, '条码重复，整版未导入');
    seen.add(entry.barcode);
    entries.push(entry);
    if (entries.length > 100000) invalid(index + 1, '有效行数超过 100000');
  }
  return entries;
}
function invalid(line: number, message: string): never {
  throw new AppError('CATALOG_FILE_INVALID', `第 ${line} 行：${message}`, 422);
}
function parseLine(line: string, lineNo: number): CatalogEntry {
  const match = /^\s*(\S(?:.*?\S)?)\s+([A-Za-z0-9_-]+)\s+(\S+)\s*$/.exec(line);
  if (!match) invalid(lineNo, '缺少规格、条码或重量');
  const [, spec, barcode, kg] = match;
  if (!spec || spec.length > 255 || !barcode || !idSchema.safeParse(barcode).success)
    invalid(lineNo, '规格或条码不合法');
  if (!kg || !/^\d+(?:\.\d+)?$/.test(kg)) invalid(lineNo, '重量必须为正十进制 kg');
  if (kg.length > 64) invalid(lineNo, '原始重量文本不能超过 64 个字符');
  const [whole, fraction = ''] = kg.split('.');
  if (/[1-9]/.test(fraction.slice(1))) invalid(lineNo, '重量必须能精确到 0.1kg，禁止舍入');
  const grams = BigInt(whole!) * 1000n + BigInt(fraction.slice(0, 1) || '0') * 100n;
  const weight = Number(grams);
  if (!gramsSchema.safeParse(weight).success) invalid(lineNo, '重量为零、负数或超出支持范围');
  return { barcode, sourceSpec: spec, rawWeightKg: kg, weightGrams: weight, legacyProductCode: null };
}
