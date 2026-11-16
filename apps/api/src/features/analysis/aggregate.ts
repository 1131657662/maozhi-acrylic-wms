import { ANALYSIS, type AnalysisQuery } from '@wms/contracts';
import type { LedgerEvent } from '../reports/types.ts';
import type { DatedEvent } from '../reports/restated-events.ts';
import { shiftDay } from '../reports/derived-common.ts';

type Event = LedgerEvent | DatedEvent;
type Flow = { inboundGrams: number; outboundGrams: number };
type Ranked = Flow & { code: string; name: string | null; rankedGrams: number };
type PeriodMovement = { month: string; inboundGrams: number | null; outboundGrams: number | null };

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function shiftMonth(day: string, offset: number): string {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function newFlow(): Flow {
  return { inboundGrams: 0, outboundGrams: 0 };
}

function addFlow(flow: Flow, family: string, grams: number): void {
  const key = family === 'inbound' ? 'inboundGrams' : 'outboundGrams';
  flow[key] += grams;
}

function addRanked(
  map: Map<string, Ranked>,
  code: string,
  family: string,
  rankBy: keyof Flow,
  grams: number,
  name: string | null,
) {
  const item = map.get(code) ?? {
    code,
    name: family === 'inbound' || family === 'outbound' ? name : null,
    inboundGrams: 0,
    outboundGrams: 0,
    rankedGrams: 0,
  };
  addFlow(item, family, grams);
  if (name === null) item.name = null;
  item.rankedGrams = item[rankBy];
  map.set(code, item);
}

function eventsFor(events: Event[], basis: AnalysisQuery['basis']) {
  return events.map((event) => ({
    event,
    day:
      basis === 'restated' && 'reportingDate' in event ? event.reportingDate : (event.localTime?.slice(0, 10) ?? null),
  }));
}

function aggregateEvents(events: Event[], query: AnalysisQuery) {
  const daily = new Map<string, Flow>(),
    monthly = new Map<string, Flow>(),
    products = new Map<string, Ranked>(),
    customers = new Map<string, Ranked>(),
    suppliers = new Map<string, Ranked>();
  let missingMovementDay = false,
    missingPartyCode = false;
  for (const { event, day } of eventsFor(events, query.basis)) {
    if (!['inbound', 'outbound'].includes(event.family)) continue;
    if (!day) {
      missingMovementDay = true;
      continue;
    }
    const grams = event.weightGrams,
      dateFlow = daily.get(day) ?? newFlow(),
      month = day.slice(0, 7),
      monthFlow = monthly.get(month) ?? newFlow();
    addFlow(dateFlow, event.family, grams);
    addFlow(monthFlow, event.family, grams);
    daily.set(day, dateFlow);
    monthly.set(month, monthFlow);
    if (day < query.fromDay || day > query.toDay) continue;
    addRanked(products, event.productCode, event.family, 'outboundGrams', grams, null);
    if (event.family === 'outbound' && event.partnerCode)
      addRanked(customers, event.partnerCode, event.family, 'outboundGrams', grams, null);
    else if (event.family === 'outbound') missingPartyCode = true;
    if (event.family === 'inbound' && event.partnerCode)
      addRanked(suppliers, event.partnerCode, event.family, 'inboundGrams', grams, null);
    else if (event.family === 'inbound') missingPartyCode = true;
  }
  return { daily, monthly, products, customers, suppliers, missingMovementDay, missingPartyCode };
}

function rank(map: Map<string, Ranked>, limit = ANALYSIS.topLimit): Ranked[] {
  return [...map.values()]
    .sort((a, b) => b.rankedGrams - a.rankedGrams || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
    .slice(0, limit);
}

function rangeTotal(daily: Map<string, Flow>, fromDay: string, toDay: string, field: keyof Flow): number {
  let total = 0;
  for (let day = fromDay; day <= toDay; day = shiftDay(day, 1)) total += daily.get(day)?.[field] ?? 0;
  return total;
}

export function movementAggregation(events: Event[], query: AnalysisQuery) {
  const result = aggregateEvents(events, query),
    trendStart = shiftMonth(monthStart(query.toDay), -(ANALYSIS.monthlyTrendMonths - 1)),
    previousDays = Math.floor((Date.parse(query.toDay) - Date.parse(query.fromDay)) / 86_400_000) + 1,
    previousToDay = shiftDay(query.fromDay, -1),
    previousFromDay = shiftDay(previousToDay, -(previousDays - 1)),
    monthly: PeriodMovement[] = [];
  for (let offset = 0; offset < ANALYSIS.monthlyTrendMonths; offset++) {
    const month = shiftMonth(trendStart, offset),
      flow = result.monthly.get(month);
    monthly.push({
      month: month.slice(0, 7),
      inboundGrams: result.missingMovementDay ? null : (flow?.inboundGrams ?? 0),
      outboundGrams: result.missingMovementDay ? null : (flow?.outboundGrams ?? 0),
    });
  }
  const comparison = {
    current: {
      fromDay: query.fromDay,
      toDay: query.toDay,
      inboundGrams: result.missingMovementDay
        ? null
        : rangeTotal(result.daily, query.fromDay, query.toDay, 'inboundGrams'),
      outboundGrams: result.missingMovementDay
        ? null
        : rangeTotal(result.daily, query.fromDay, query.toDay, 'outboundGrams'),
    },
    previous: {
      fromDay: previousFromDay,
      toDay: previousToDay,
      inboundGrams: result.missingMovementDay
        ? null
        : rangeTotal(result.daily, previousFromDay, previousToDay, 'inboundGrams'),
      outboundGrams: result.missingMovementDay
        ? null
        : rangeTotal(result.daily, previousFromDay, previousToDay, 'outboundGrams'),
    },
  };
  return {
    monthly,
    comparison,
    tops: { products: rank(result.products), customers: rank(result.customers), suppliers: rank(result.suppliers) },
    missingMovementDay: result.missingMovementDay,
    missingPartyCode: result.missingPartyCode,
    heatmapStart: shiftDay(query.toDay, -(ANALYSIS.heatmapDays - 1)),
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
        value: inboundGrams === null || outboundGrams === null ? null : inboundGrams + outboundGrams,
      };
    }),
  };
}
