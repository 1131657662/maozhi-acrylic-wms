import { createHash } from 'node:crypto';
export interface CatalogEntry {
  barcode: string;
  sourceSpec: string | null;
  rawWeightKg: string;
  weightGrams: number;
  legacyProductCode: string | null;
}
export function contentHash(entries: CatalogEntry[]): string {
  const ordered = [...entries].sort((a, b) => Buffer.compare(Buffer.from(a.barcode), Buffer.from(b.barcode)));
  return createHash('sha256')
    .update(JSON.stringify(ordered.map((e) => [e.barcode, e.sourceSpec, e.weightGrams])))
    .digest('hex');
}
export function bytesHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
