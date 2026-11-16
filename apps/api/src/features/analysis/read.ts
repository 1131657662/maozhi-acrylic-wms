import { ANALYSIS, type AnalysisQuery, type Analysis } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { reportSnapshot } from '../reports/snapshot.ts';
import { buildProjection } from '../reports/projection.ts';
import { restatedEventsFromProjection } from '../reports/restated-events.ts';
import { shanghaiToday } from '../reports/derived-common.ts';
import { movementAggregation } from './aggregate.ts';
import { durationSummary } from './duration.ts';
import { movementGroups } from './movement-query.ts';
import { shiftMonth, projectionQuery, buildDerived } from './derived.ts';
import { analysisResponse } from './response.ts';

export async function readAnalysis(db: Database, query: AnalysisQuery): Promise<Analysis> {
  if (query.toDay > shanghaiToday())
    throw new AppError('REPORT_FUTURE', '不能将未来日期视为已入账区间，请选择今天或更早的截止日', 422);
  const snapshot = await reportSnapshot(db, {}),
    fromDay = shiftMonth(query.toDay, -(ANALYSIS.turnoverMonths - 1));
  const [projected, grouped] = await Promise.allSettled([
    buildProjection(db, projectionQuery(query, fromDay), { captureEvents: true, analysis: true, snapshot }),
    movementGroups(db, query, snapshot),
  ]);
  // Wait for both paths, including any queued reads, before the transaction can commit or roll back.
  if (projected.status === 'rejected') throw projected.reason;
  if (grouped.status === 'rejected') throw grouped.reason;
  const projection = projected.value,
    restated = query.basis === 'restated' ? restatedEventsFromProjection(projection) : undefined,
    movement = movementAggregation(grouped.value, query),
    derived = buildDerived(projection, query, restated),
    duration = await durationSummary(db, query, snapshot);
  return analysisResponse({ query, projection, movement, derived, duration });
}
