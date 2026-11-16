import { ANALYSIS, type AnalysisQuery } from '@wms/contracts';
import { addExact } from '../reports/arithmetic.ts';
import { shiftDay } from '../reports/derived-common.ts';

import { aggregateEvents, rank, type Event, type Flow, type AggregationState } from './movement-accumulator.ts';

type PeriodMovement = {
  month: string;
  inboundGrams: number | null;
  outboundGrams: number | null;
  inboundPackages: number | null;
  outboundPackages: number | null;
};

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function shiftMonth(day: string, offset: number): string {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function rangeTotal(result: AggregationState, fromDay: string, toDay: string, field: keyof Flow): number {
  let total = 0,
    day = fromDay;
  while (day <= toDay) {
    const nextMonth = shiftMonth(day, 1),
      lastMonthDay = shiftDay(nextMonth, -1);
    if (day.endsWith('-01') && lastMonthDay <= toDay) {
      total = addExact(total, result.monthly.get(day.slice(0, 7))?.[field] ?? 0);
      day = nextMonth;
    } else {
      total = addExact(total, result.daily.get(day)?.[field] ?? 0);
      day = shiftDay(day, 1);
    }
  }
  return total;
}

export function movementAggregation(events: Event[], query: AnalysisQuery) {
  const trendStart = shiftMonth(monthStart(query.toDay), -(ANALYSIS.monthlyTrendMonths - 1)),
    heatmapStart = shiftDay(query.toDay, -(ANALYSIS.heatmapDays - 1)),
    previousDays = Math.floor((Date.parse(query.toDay) - Date.parse(query.fromDay)) / 86_400_000) + 1,
    previousToDay = shiftDay(query.fromDay, -1),
    previousFromDay = shiftDay(previousToDay, -(previousDays - 1)),
    aggregationStart = [trendStart, previousFromDay, heatmapStart].sort()[0]!,
    result = aggregateEvents(events, query, aggregationStart),
    monthly: PeriodMovement[] = [];
  for (let offset = 0; offset < ANALYSIS.monthlyTrendMonths; offset++) {
    const month = shiftMonth(trendStart, offset),
      flow = result.monthly.get(month.slice(0, 7));
    monthly.push({
      month: month.slice(0, 7),
      inboundGrams: result.missingMovementDay ? null : (flow?.inboundGrams ?? 0),
      outboundGrams: result.missingMovementDay ? null : (flow?.outboundGrams ?? 0),
      inboundPackages: result.missingMovementDay ? null : (flow?.inboundPackages ?? 0),
      outboundPackages: result.missingMovementDay ? null : (flow?.outboundPackages ?? 0),
    });
  }
  const comparison = {
    current: {
      fromDay: query.fromDay,
      toDay: query.toDay,
      inboundGrams: result.missingMovementDay ? null : rangeTotal(result, query.fromDay, query.toDay, 'inboundGrams'),
      outboundGrams: result.missingMovementDay ? null : rangeTotal(result, query.fromDay, query.toDay, 'outboundGrams'),
    },
    previous: {
      fromDay: previousFromDay,
      toDay: previousToDay,
      inboundGrams: result.missingMovementDay
        ? null
        : rangeTotal(result, previousFromDay, previousToDay, 'inboundGrams'),
      outboundGrams: result.missingMovementDay
        ? null
        : rangeTotal(result, previousFromDay, previousToDay, 'outboundGrams'),
    },
  };
  return {
    monthly,
    comparison,
    tops: { products: rank(result.products), customers: rank(result.customers), suppliers: rank(result.suppliers) },
    missingMovementDay: result.missingMovementDay,
    missingPartyCode: result.missingPartyCode,
    heatmapStart,
    daily: result.daily,
    trendStart,
  };
}

export function heatmapSeries(movement: ReturnType<typeof movementAggregation>) {
  return {
    days: Array.from({ length: ANALYSIS.heatmapDays }, (_, index) => {
      const day = shiftDay(movement.heatmapStart, index),
        flow = movement.daily.get(day),
        inboundGrams = movement.missingMovementDay ? null : (flow?.inboundGrams ?? 0),
        outboundGrams = movement.missingMovementDay ? null : (flow?.outboundGrams ?? 0);
      return {
        day,
        inboundGrams,
        outboundGrams,
        value: inboundGrams === null || outboundGrams === null ? null : addExact(inboundGrams, outboundGrams),
      };
    }),
  };
}
