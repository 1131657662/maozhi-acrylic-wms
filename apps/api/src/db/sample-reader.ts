import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

export type SampleRow = Record<string, string | null>;

const nullToken = '__NULL__';

export function readSampleCsv(fileName: string): SampleRow[] {
  const text = readFileSync(new URL(`../../../../.local/prod-sample/${fileName}.csv`, import.meta.url), 'utf8');
  const rows = parse(text, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[];
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === nullToken ? null : value])));
}

export function readSkuFile(): { spec: string; barcode: string; weightKg: string }[] {
  const text = readFileSync('C:/Users/qq113/Desktop/sku.txt', { encoding: 'latin1' });
  const bytes = Buffer.from(text, 'latin1');
  const decoded = new TextDecoder('gb18030', { fatal: true }).decode(bytes);
  return decoded.split(/\r?\n/).filter(Boolean).map(parseSkuLine);
}

function parseSkuLine(line: string): { spec: string; barcode: string; weightKg: string } {
  const match = /^\s*(.*?)\s+([A-Za-z0-9-]+)\s+([0-9]+(?:\.[0-9]+)?)\s*$/.exec(line);
  if (!match) throw new Error(`sku.txt 行格式错误: ${line}`);
  return { spec: match[1]!.replace(/\s+/g, ' ').trim(), barcode: match[2]!, weightKg: match[3]! };
}

export function required(row: SampleRow, field: string): string {
  const value = row[field];
  if (value === null || value === undefined || value.trim() === '') throw new Error(`样本字段 ${field} 缺失`);
  return value;
}

export function optional(row: SampleRow, field: string): string | null {
  const value = row[field];
  return value === null || value === undefined || value === '' ? null : value;
}

export function intValue(row: SampleRow, field: string): number {
  const value = required(row, field);
  if (!/^-?\d+$/.test(value)) throw new Error(`样本字段 ${field} 不是整数`);
  return Number(value);
}

export function jsonRow(row: SampleRow): string {
  return JSON.stringify(row);
}
