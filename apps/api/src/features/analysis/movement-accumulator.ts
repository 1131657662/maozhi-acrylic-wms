import { ANALYSIS, type AnalysisQuery } from '@wms/contracts';
import type { LedgerEvent } from '../reports/types.ts';
import type { DatedEvent } from '../reports/restated-events.ts';
import { addExact } from '../reports/arithmetic.ts';

export type Event = LedgerEvent | DatedEvent;
export type Flow = { inboundGrams: number; outboundGrams: number };
type Ranked = Flow & { code: string; name: string | null; rankedGrams: number };
type MonthlyFlow = Flow & { inboundPackages: number; outboundPackages: number };
export type AggregationState = {
  daily: Map<string, MonthlyFlow>;
  monthly: Map<string, MonthlyFlow>;
  products: Map<string, Ranked>;
  customers: Map<string, Ranked>;
  suppliers: Map<string, Ranked>;
  missingMovementDay: boolean;
  missingPartyCode: boolean;
};

function newFlow(): MonthlyFlow {
  return { inboundGrams: 0, outboundGrams: 0, inboundPackages: 0, outboundPackages: 0 };
}

function addFlow(flow: Flow, family: string, grams: number): void {
  const key = family === 'inbound' ? 'inboundGrams' : 'outboundGrams';
  flow[key] = addExact(flow[key], grams);
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

function eventDay(event: Event, basis: AnalysisQuery['basis']): string | null {
  return basis === 'restated' && 'reportingDate' in event
    ? (event.reportingDate ?? null)
    : (event.localTime?.slice(0, 10) ?? null);
}

function aggregateEvent(
  state: AggregationState,
  event: Event,
  day: string | null,
  query: AnalysisQuery,
  fromDay: string,
) {
  if (!['inbound', 'outbound'].includes(event.family)) return;
  if (!day) {
    state.missingMovementDay = true;
    return;
  }
  if (day < fromDay || day > query.toDay) return;
  const grams = event.weightGrams,
    dateFlow = state.daily.get(day) ?? newFlow(),
    month = day.slice(0, 7),
    monthFlow = state.monthly.get(month) ?? newFlow();
  addFlow(dateFlow, event.family, grams);
  addFlow(monthFlow, event.family, grams);
  const packageKey = event.family === 'inbound' ? 'inboundPackages' : 'outboundPackages';
  dateFlow[packageKey] = addExact(dateFlow[packageKey], event.packages);
  monthFlow[packageKey] = addExact(monthFlow[packageKey], event.packages);
  state.daily.set(day, dateFlow);
  state.monthly.set(month, monthFlow);
  if (day < query.fromDay) return;
  addRanked(state.products, event.productCode, event.family, 'outboundGrams', grams, null);
  addPartyRanks(state, event, grams);
}

function addPartyRanks(state: AggregationState, event: Event, grams: number): void {
  if (event.family === 'outbound' && event.partnerCode)
    addRanked(state.customers, event.partnerCode, event.family, 'outboundGrams', grams, null);
  else if (event.family === 'outbound') state.missingPartyCode = true;
  if (event.family === 'inbound' && event.partnerCode)
    addRanked(state.suppliers, event.partnerCode, event.family, 'inboundGrams', grams, null);
  else if (event.family === 'inbound') state.missingPartyCode = true;
}

export function aggregateEvents(events: Event[], query: AnalysisQuery, fromDay: string): AggregationState {
  const state: AggregationState = {
    daily: new Map(),
    monthly: new Map(),
    products: new Map(),
    customers: new Map(),
    suppliers: new Map(),
    missingMovementDay: false,
    missingPartyCode: false,
  };
  for (const event of events) aggregateEvent(state, event, eventDay(event, query.basis), query, fromDay);
  return state;
}

export function rank(map: Map<string, Ranked>, limit = ANALYSIS.topLimit): Ranked[] {
  return [...map.values()]
    .filter((item) => item.rankedGrams > 0)
    .sort((a, b) => b.rankedGrams - a.rankedGrams || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
    .slice(0, limit);
}
