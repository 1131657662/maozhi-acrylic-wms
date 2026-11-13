import {
  CATALOG_ERROR_MAX_ROWS,
  CATALOG_ERROR_LINE_MAX_LENGTH,
  CATALOG_UPLOAD_MAX_BYTES,
  CATALOG_UPLOAD_MAX_ROWS,
  catalogExportCopy,
  type CatalogUploadErrors,
} from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import type { CatalogEntry } from './hash.ts';
import { invalidCatalogLine, parseCatalogLine } from './parse-line.ts';

function decodeCatalog(bytes: Buffer, encoding: string): string {
  if (bytes.length > CATALOG_UPLOAD_MAX_BYTES) throw new AppError('CATALOG_FILE_TOO_LARGE', '文件不能超过 5 MiB', 413);
  if (!['utf-8', 'gb18030'].includes(encoding))
    throw new AppError('CATALOG_ENCODING_UNSUPPORTED', '请选择 UTF-8 或 GB18030 编码', 415);
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new AppError('CATALOG_FILE_INVALID', '文件编码无法完整解码，请核对所选编码', 422);
  }
}
function truncateLine(line: string): string {
  let result = '',
    length = 0;
  for (const character of line) {
    if (length++ === CATALOG_ERROR_LINE_MAX_LENGTH) break;
    result += character;
  }
  return result;
}
function retainError(report: CatalogUploadErrors, input: { error: unknown; line: string; number: number }): void {
  if (!(input.error instanceof AppError) || input.error.code !== 'CATALOG_FILE_INVALID') throw input.error;
  if (report.errors.length < CATALOG_ERROR_MAX_ROWS)
    report.errors.push({
      line: input.number,
      raw: truncateLine(input.line),
      reason: input.error.message.replace(/^第 \d+ 行：/, '').replaceAll('kg', '千克'),
    });
  else report.truncated = true;
}
export function parseCatalog(bytes: Buffer, encoding: string): CatalogEntry[] {
  const lines = decodeCatalog(bytes, encoding)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);
  const entries: CatalogEntry[] = [],
    seen = new Set<string>();
  const report: CatalogUploadErrors = { errors: [], truncated: false };
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      const entry = parseCatalogLine(line, index + 1);
      if (seen.has(entry.barcode)) invalidCatalogLine(index + 1, '条码重复，整版未导入');
      seen.add(entry.barcode);
      if (entries.length >= CATALOG_UPLOAD_MAX_ROWS) invalidCatalogLine(index + 1, '有效行数超过 100000');
      entries.push(entry);
    } catch (error) {
      retainError(report, { error, line, number: index + 1 });
    }
  }
  if (report.errors.length) {
    const first = report.errors[0]!;
    throw new AppError(
      'CATALOG_FILE_INVALID',
      report.truncated ? catalogExportCopy.tooManyErrors : `第 ${first.line} 行：${first.reason}`,
      422,
      report,
    );
  }
  return entries;
}
