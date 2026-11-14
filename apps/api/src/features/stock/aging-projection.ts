import { STOCK_AGING_UPPER_DAYS, type StockAging } from '@wms/contracts';
import { applyFifo, emptyFifo, markFifoUnknown } from '../reports/fifo.ts';
import { bucketFifo } from '../reports/fifo-buckets.ts';
import { invalidEvent } from '../reports/accumulate.ts';
import { nullableInt, objectJson, optionalGrams } from '../reports/source-values.ts';
import type { LedgerEvent } from '../reports/types.ts';

interface AgingBalance {
  packages: number;
  weightGrams: number;
  sourceRow: unknown;
}
const SHANGHAI_OFFSET_MS = 8 * 3_600_000;

function matchesStock(events: LedgerEvent[], stock: AgingBalance) {
  const last = events.at(-1);
  if (last?.afterGrams !== stock.weightGrams || last.afterPackages !== stock.packages) return false;
  const historical = events.findLast((event) => event.historical);
  if (!historical) return true;
  const source = objectJson(stock.sourceRow);
  return (
    historical.afterPackages === nullableInt(source.stock_qty) &&
    historical.afterGrams === optionalGrams(source.stock_weight)
  );
}

export function projectStockAging(events: LedgerEvent[], stock: AgingBalance, asOf: string): StockAging {
  const fifo = emptyFifo();
  let previous: LedgerEvent | undefined;
  let invalidTime = false;
  for (const event of events) {
    invalidTime ||=
      !event.localTime ||
      !event.postedAt ||
      Date.parse(event.postedAt) > Date.parse(asOf) ||
      Boolean(previous?.localTime && event.localTime < previous.localTime);
    if (invalidEvent(event) || (previous && previous.afterPackages !== event.beforePackages)) markFifoUnknown(fifo);
    applyFifo(fifo, event, event.afterGrams);
    previous = event;
  }
  if (invalidTime || !matchesStock(events, stock)) markFifoUnknown(fifo);
  const cutoffDay = new Date(Date.parse(asOf) + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
  const bins = bucketFifo(fifo, cutoffDay, { closingGrams: stock.weightGrams, upperDays: STOCK_AGING_UPPER_DAYS });
  // Zero means no grams were assigned to that age; the entire unknown balance remains explicit.
  return {
    agingBuckets: [bins[0] ?? 0, bins[1] ?? 0, bins[2] ?? 0, bins[3] ?? 0, bins[4] ?? 0],
    unagingGrams: bins[5] ?? stock.weightGrams,
  };
}
