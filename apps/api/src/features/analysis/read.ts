import { analysisSchema, ANALYSIS, type AnalysisQuery, type Analysis } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { reportSnapshot } from '../reports/snapshot.ts';
import { buildProjection } from '../reports/projection.ts';
import { restatedEventsFromProjection, type DatedEvent } from '../reports/restated-events.ts';
import { derivedRows } from '../reports/derived-rows.ts';
import { agingChart, turnoverChart } from '../reports/derived-chart.ts';
import { shiftDay, shanghaiToday } from '../reports/derived-common.ts';
import type {
  ReportAgingQuery,
  ReportAgingRow,
  ReportQuery,
  ReportTurnoverQuery,
  ReportTurnoverRow,
} from '@wms/contracts';
import { heatmapSeries, movementAggregation } from './aggregate.ts';
import { analysisCopy as copy } from './copy.ts';
import { durationSummary } from './duration.ts';

function shiftMonth(day: string, offset: number): string {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function projectionQuery(query: AnalysisQuery, fromDay: string): ReportQuery {
  return {
    scope: 'inventory',
    basis: query.basis,
    fromDay,
    toDay: query.toDay,
    warehouse: '',
    product: '',
    movement: 'all',
    page: 1,
    pageSize: 20,
    sortBy: 'postedAt',
    direction: 'asc',
  };
}

function derivedQuery(query: AnalysisQuery, fromDay: string): ReportTurnoverQuery {
  return {
    scope: 'inventory',
    basis: query.basis,
    fromDay,
    toDay: query.toDay,
    warehouse: '',
    product: '',
    page: 1,
    pageSize: 20,
    sortBy: 'warehouseCode',
    direction: 'asc',
  };
}

function block<T>(
  data: T | null,
  unit: '克' | '小时' | '次/天',
  fromDay: string,
  toDay: string,
  basis: AnalysisQuery['basis'],
  verification: 'verified' | 'unverifiable' | 'failed',
  reason: string | null,
) {
  return { data, unit, period: { fromDay, toDay }, basis, verification, reason };
}

function allEvents(projection: Awaited<ReturnType<typeof buildProjection>>): DatedEvent[] {
  return restatedEventsFromProjection(projection);
}

function fromDateRange(query: AnalysisQuery): string {
  const days = Math.floor((Date.parse(query.toDay) - Date.parse(query.fromDay)) / 86_400_000) + 1;
  return shiftDay(query.fromDay, -days);
}

function projectFrom(query: AnalysisQuery): string {
  const trendStart = shiftMonth(query.toDay, -(ANALYSIS.monthlyTrendMonths - 1)),
    compareStart = fromDateRange(query);
  return [trendStart, compareStart].sort()[0]!;
}

function buildDerived(
  projection: Awaited<ReturnType<typeof buildProjection>>,
  query: AnalysisQuery,
  restated?: DatedEvent[],
) {
  const agingQuery = { ...derivedQuery(query, query.fromDay), cutoffDay: query.toDay } as ReportAgingQuery,
    agingRows = derivedRows('report-aging', agingQuery, [...projection.cells.values()], projection) as ReportAgingRow[],
    aging = agingChart(agingRows),
    turnoverStart = shiftMonth(query.toDay, -(ANALYSIS.turnoverMonths - 1)),
    turnoverQuery = derivedQuery(query, turnoverStart),
    turnoverRows = derivedRows(
      'report-turnover',
      turnoverQuery,
      [...projection.cells.values()],
      projection,
      restated,
    ) as ReportTurnoverRow[],
    turnover = turnoverChart({ query: turnoverQuery, projection, rows: turnoverRows, restated });
  return { aging, turnover: turnover.points.slice(-ANALYSIS.turnoverMonths) };
}

export async function readAnalysis(db: Database, query: AnalysisQuery): Promise<Analysis> {
  if (query.toDay > shanghaiToday())
    throw new AppError('REPORT_FUTURE', '不能将未来日期视为已入账区间，请选择今天或更早的截止日', 422);
  const snapshot = await reportSnapshot(db, {}),
    projection = await buildProjection(db, projectionQuery(query, projectFrom(query)), {
      captureEvents: true,
      analysis: true,
      snapshot,
    }),
    restated = query.basis === 'restated' ? allEvents(projection) : undefined,
    events = restated ?? [...projection.cells.values()].flatMap((cell) => cell.events ?? []),
    movement = movementAggregation(events, query),
    derived = buildDerived(projection, query, restated),
    duration = await durationSummary(db, query, snapshot),
    monthlyReason = movement.missingMovementDay ? copy.missingMovementDay : null,
    topsReason = movement.missingMovementDay
      ? copy.missingMovementDay
      : movement.missingPartyCode
        ? copy.missingPartyCode
        : null,
    agingReason = derived.aging.reasons.length ? derived.aging.reasons.join('；') : null,
    turnoverReasons = [...new Set(derived.turnover.flatMap((point) => point.reasons))],
    turnoverReason = turnoverReasons.length ? turnoverReasons.join('；') : null,
    durationReason = duration.missingEvidence ? copy.missingDurationEvidence : null,
    asOf = snapshot.watermarks.asOf;
  const response = {
    asOf,
    watermark: hash(JSON.stringify([snapshot.watermarks, projection.digest, query, duration])),
    fromDay: query.fromDay,
    toDay: query.toDay,
    basis: query.basis,
    monthly: block(
      movement.missingMovementDay ? null : { points: movement.monthly },
      '克',
      movement.trendStart,
      query.toDay,
      query.basis,
      movement.missingMovementDay ? 'unverifiable' : 'verified',
      monthlyReason,
    ),
    comparison: block(
      movement.missingMovementDay ? null : movement.comparison,
      '克',
      movement.comparison.previous.fromDay,
      query.toDay,
      query.basis,
      movement.missingMovementDay ? 'unverifiable' : 'verified',
      monthlyReason,
    ),
    tops: block(
      movement.missingMovementDay ? null : movement.tops,
      '克',
      query.fromDay,
      query.toDay,
      query.basis,
      topsReason ? 'unverifiable' : 'verified',
      topsReason,
    ),
    aging: block(
      {
        buckets: derived.aging.buckets,
        unagedGrams: derived.aging.unagedGrams,
        closingGrams: derived.aging.closingGrams,
      },
      '克',
      query.toDay,
      query.toDay,
      'posted',
      derived.aging.reasons.length ? 'unverifiable' : 'verified',
      agingReason,
    ),
    turnover: block(
      derived.turnover.map((point) => ({
        month: point.month,
        turns: point.turns,
        turnoverDays: point.turnoverDays,
        reasons: point.reasons,
      })),
      '次/天',
      shiftMonth(query.toDay, -(ANALYSIS.turnoverMonths - 1)),
      query.toDay,
      query.basis,
      turnoverReason ? 'unverifiable' : 'verified',
      turnoverReason,
    ),
    heatmap: block(
      heatmapSeries(movement),
      '克',
      movement.heatmapStart,
      query.toDay,
      query.basis,
      movement.missingMovementDay ? 'unverifiable' : 'verified',
      monthlyReason,
    ),
    duration: block(
      {
        inboundAverageHours: duration.inboundAverageHours,
        inboundCompleted: duration.inboundCompleted,
        outboundAverageHours: duration.outboundAverageHours,
        outboundCompleted: duration.outboundCompleted,
        longestPending: duration.longestPending,
      },
      '小时',
      query.fromDay,
      query.toDay,
      'posted',
      durationReason ? 'unverifiable' : 'verified',
      durationReason,
    ),
  };
  return analysisSchema.parse(response);
}
