import type { CatalogDiffRow } from '@wms/contracts';
import type { CatalogEntry } from './hash.ts';
export function catalogDiff(before: CatalogEntry[], after: CatalogEntry[]): CatalogDiffRow[] {
  const old = new Map(before.map((e) => [e.barcode, e]));
  const next = new Map(after.map((e) => [e.barcode, e]));
  return [...new Set([...old.keys(), ...next.keys()])]
    .sort()
    .map((barcode) => diffRow(barcode, old.get(barcode), next.get(barcode)));
}
function diffRow(barcode: string, old: CatalogEntry | undefined, next: CatalogEntry | undefined): CatalogDiffRow {
  const weightChanged = !!old && !!next && old.weightGrams !== next.weightGrams;
  const specChanged = !!old && !!next && old.sourceSpec !== next.sourceSpec;
  const kind = !old ? 'added' : !next ? 'removed' : weightChanged || specChanged ? 'changed' : 'unchanged';
  return {
    barcode,
    kind,
    oldSpec: old?.sourceSpec ?? null,
    newSpec: next?.sourceSpec ?? null,
    oldWeightGrams: old?.weightGrams ?? null,
    newWeightGrams: next?.weightGrams ?? null,
    weightChanged,
    specChanged,
  };
}
export function diffCounts(rows: CatalogDiffRow[]) {
  return {
    added: rows.filter((r) => r.kind === 'added').length,
    removed: rows.filter((r) => r.kind === 'removed').length,
    weight: rows.filter((r) => r.weightChanged).length,
    spec: rows.filter((r) => r.specChanged).length,
    changed: rows.filter((r) => r.kind === 'changed').length,
    unchanged: rows.filter((r) => r.kind === 'unchanged').length,
  };
}
