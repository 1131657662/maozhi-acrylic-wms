import { analysisSchema, ANALYSIS, type AnalysisQuery } from '@wms/contracts';
import { hash } from '../../shared/hash.ts';
import type { Projection } from '../reports/types.ts';
import { heatmapSeries, type movementAggregation } from './aggregate.ts';
import { analysisCopy as copy } from './copy.ts';
import type { durationSummary } from './duration.ts';
import { shiftMonth, type buildDerived } from './derived.ts';

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

export function analysisResponse({
  query,
  projection,
  movement,
  derived,
  duration,
}: {
  query: AnalysisQuery;
  projection: Projection;
  movement: ReturnType<typeof movementAggregation>;
  derived: ReturnType<typeof buildDerived>;
  duration: Awaited<ReturnType<typeof durationSummary>>;
}) {
  const snapshot = projection.snapshot;
  const monthlyReason = projection.metadata.unassignedRows
      ? copy.missingSource
      : movement.missingMovementDay
        ? copy.missingMovementDay
        : null,
    topsReason = projection.metadata.unassignedRows
      ? copy.missingSource
      : movement.missingMovementDay
        ? copy.missingMovementDay
        : movement.missingPartyCode
          ? copy.missingPartyCode
          : null,
    agingReason = derived.aging.reasons.length ? derived.aging.reasons.join('；') : null,
    turnoverReasons = [...new Set(derived.turnover.flatMap((point) => point.reasons))],
    turnoverReason = turnoverReasons.length ? turnoverReasons.join('；') : null,
    durationReason = duration.missingEvidence
      ? copy.missingDurationEvidence
      : [
          !duration.inboundCompleted ? copy.noInboundDuration : '',
          !duration.outboundCompleted ? copy.noOutboundDuration : '',
        ]
          .filter(Boolean)
          .join('；') || null,
    asOf = snapshot.watermarks.asOf;
  movement.missingMovementDay ||= Boolean(projection.metadata.unassignedRows);
  const response = {
    asOf,
    watermark: hash(
      JSON.stringify([
        snapshot.watermarks,
        projection.digest,
        query,
        movement.monthly,
        movement.tops,
        derived,
        duration,
      ]),
    ),
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
      duration.missingEvidence ? 'unverifiable' : 'verified',
      durationReason,
    ),
  };
  return analysisSchema.parse(response);
}
