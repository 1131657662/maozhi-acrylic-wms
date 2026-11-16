import type {
  ReportAgingChart,
  ReportAgingRow,
  ReportTurnoverChart,
  ReportTurnoverQuery,
  ReportTurnoverRow,
} from '@wms/contracts';
import type { Cell, Projection } from './types.ts';
import type { DatedEvent } from './restated-events.ts';
import { turnoverChartRow } from './turnover-basis.ts';
import { agingTotals, turnoverTotals } from './derived-totals.ts';
import { shiftDay, snapshotPeriod } from './derived-common.ts';
import { turnoverMetrics } from './turnover-metrics.ts';

function turnoverChartCells(projection: Projection, restated: boolean): Cell[] {
  const emptyStates = new Set<string>(),
    cells: Cell[] = [];
  for (const cell of projection.cells.values()) {
    if (!restated && !cell.events?.length) {
      // No events contribute zero outbound and unknown daily balances. Repeating identical states
      // cannot change SUM(0), null propagation or the union of reasons; stock/aging totals stay untouched.
      const state = cell.periods.get('range')!,
        key = JSON.stringify([state.checkState, state.reasons]);
      if (emptyStates.has(key)) continue;
      emptyStates.add(key);
    }
    cells.push(cell);
  }
  return cells;
}

export function turnoverChart(args: {
  query: ReportTurnoverQuery;
  projection: Projection;
  rows: ReportTurnoverRow[];
  restated?: DatedEvent[];
}): ReportTurnoverChart {
  const { query, projection, rows, restated } = args;
  const datedCells = new Map<string, DatedEvent[]>();
  for (const event of restated ?? []) {
    const key = JSON.stringify([event.warehouseCode, event.productCode]);
    const events = datedCells.get(key) ?? [];
    events.push(event);
    datedCells.set(key, events);
  }
  // Reuse one captured snapshot; no monthly database rereads or browser aggregation.
  const cells = turnoverChartCells(projection, Boolean(restated));
  const points = projection.periods.slice(1).map((period) => {
    const range = { ...query, fromDay: period.start.slice(0, 10), toDay: shiftDay(period.end.slice(0, 10), -1) };
    const items = cells.map((cell) =>
      turnoverChartRow(
        range,
        cell,
        projection,
        restated ? (datedCells.get(JSON.stringify([cell.warehouseCode, cell.productCode])) ?? []) : undefined,
      ),
    );
    return {
      month: period.key,
      fromDay: range.fromDay,
      toDay: range.toDay,
      ...turnoverMetrics(
        turnoverTotals(items),
        snapshotPeriod(range, projection).days.length,
        items.flatMap((row) => row.reasons),
      ),
    };
  });
  const days = snapshotPeriod(query, projection).days.length;
  const totals = turnoverMetrics(
    turnoverTotals(rows),
    days,
    rows.flatMap((row) => row.reasons),
  );
  return { points, totals, empty: rows.length === 0 || days === 0, reasons: totals.reasons };
}

export function agingChart(rows: ReportAgingRow[]): ReportAgingChart {
  const totals = agingTotals(rows);
  const buckets: ReportAgingChart['buckets'] = [
    totals.age0To30Grams,
    totals.age31To90Grams,
    totals.age91To180Grams,
    totals.age181To365Grams,
    totals.ageOver365Grams,
  ];
  const older = buckets.slice(2);
  const reasons = [...new Set(rows.flatMap((row) => row.reasons))];
  const over90Percent =
    totals.closingGrams !== null && totals.closingGrams > 0 && older.every((value) => value !== null)
      ? ((older.reduce<number>((sum, value) => sum + value!, 0) / totals.closingGrams) * 100).toFixed(2)
      : null;
  if (over90Percent === null) reasons.push('截止库存为零或年龄证据不足，超 90 天占比无法计算');
  return {
    buckets,
    unagedGrams: totals.unagedGrams,
    closingGrams: totals.closingGrams,
    over90Percent,
    empty: rows.length === 0,
    reasons,
  };
}
