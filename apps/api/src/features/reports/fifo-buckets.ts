import type { FifoState } from './fifo.ts';

const REPORT_AGING_UPPER_DAYS = [30, 90, 180, 365] as const;
const DAY_MS = 86_400_000;
interface BucketOptions {
  closingGrams: number | null;
  upperDays: readonly [number, number, number, number];
}

export function bucketFifo(state: FifoState, cutoffDay: string, { closingGrams, upperDays }: BucketOptions) {
  if (closingGrams === null) return [null, null, null, null, null, null];
  if (closingGrams === 0) return [0, 0, 0, 0, 0, 0];
  const unknown = () => [null, null, null, null, null, closingGrams];
  if (state.tainted) return unknown();
  const bins = [0, 0, 0, 0, 0, 0],
    cutoff = Date.parse(cutoffDay + 'T00:00:00Z');
  for (const layer of state.layers) {
    if (layer.grams <= 0) continue;
    const age = Math.floor((cutoff - Date.parse(layer.ageDay + 'T00:00:00Z')) / DAY_MS);
    if (!Number.isFinite(age) || age < 0) return unknown();
    const match = upperDays.findIndex((upper) => age <= upper);
    const index = match < 0 ? upperDays.length : match;
    bins[index] = (bins[index] ?? 0) + layer.grams;
  }
  if (bins.slice(0, 5).reduce((sum, grams) => sum + grams, 0) !== closingGrams) return unknown();
  return bins;
}

export function ageBuckets(state: FifoState, cutoffDay: string, closingGrams: number | null) {
  return bucketFifo(state, cutoffDay, { closingGrams, upperDays: REPORT_AGING_UPPER_DAYS });
}
