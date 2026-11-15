import { reportDetailRowSchema, type ReportQuery, type ReportKind } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { buildProjection } from './projection.ts';
import { readDatedEvents, type DatedEvent } from './restated-events.ts';
import { buildRestatement, postedView } from './restated.ts';
import { restatedMonths } from './restated-months.ts';
import { baseFacets, matchesEvent, movementFiltered, visibleEvents } from './facets.ts';
import { monthlyChart } from './monthly-chart.ts';
import type { ReportSnapshot } from './snapshot.ts';

function detailRows(events: DatedEvent[], projection: Awaited<ReturnType<typeof buildProjection>>, query: ReportQuery) {
  const sign = query.direction === 'asc' ? 1 : -1;
  const key = ['postedAt', 'period'].includes(query.sortBy)
    ? query.basis === 'restated'
      ? 'reportingDate'
      : 'localTime'
    : query.sortBy;
  return [...events]
    .sort(
      (a, b) =>
        sign *
        (String(a[key as keyof DatedEvent] ?? '9999').localeCompare(String(b[key as keyof DatedEvent] ?? '9999')) ||
          a.sequence - b.sequence),
    )
    .map((event) => {
      const cell = projection.cells.get(JSON.stringify([event.warehouseCode, event.productCode]));
      const row: Record<string, unknown> = {
        ...event,
        checkState: cell?.periods.get(event.localTime?.slice(0, 7) ?? '')?.checkState ?? '不可验证',
      };
      if (query.basis === 'posted') {
        delete row.effectiveBusinessDate;
        delete row.reportingDate;
        delete row.dateReason;
      }
      return reportDetailRowSchema.parse(
        Object.fromEntries(Object.keys(reportDetailRowSchema.shape).map((k) => [k, row[k as keyof typeof row]])),
      );
    });
}
export async function interactionModel(
  db: Database,
  options: { kind: ReportKind; query: ReportQuery; snapshot: ReportSnapshot },
) {
  const { kind, query, snapshot } = options,
    broadQuery = { ...query, warehouseCodes: undefined };
  const broad = await buildProjection(db, broadQuery, { snapshot });
  const projection = query.warehouseCodes ? await buildProjection(db, query, { snapshot }) : broad;
  const restated = query.basis === 'restated' ? await buildRestatement(db, query, projection) : undefined;
  const rawEvents = await readDatedEvents(db, broadQuery, broad);
  const events =
    query.basis === 'posted'
      ? rawEvents.map((e) => ({ ...e, reportingDate: e.localTime?.slice(0, 10) ?? null }))
      : rawEvents;
  const selected = visibleEvents(events, query).filter((e) => matchesEvent(e, query));
  const monthly = movementFiltered(query)
    ? restatedMonths(selected, projection, restated?.view.restatedBalance).filter((r) =>
        selected.some(
          (e) =>
            e.reportingDate?.startsWith(r.period) &&
            e.warehouseCode === r.warehouseCode &&
            e.productCode === r.productCode,
        ),
      )
    : (restated?.monthly ?? projection.monthly);
  const sign = query.direction === 'asc' ? 1 : -1,
    key = query.sortBy === 'postedAt' ? 'period' : query.sortBy;
  const rows =
    kind === 'report-details'
      ? detailRows(selected, projection, query)
      : [...monthly].sort((a, b) => sign * (a[key].localeCompare(b[key]) || a.id.localeCompare(b.id)));
  const chart =
    kind === 'report-monthly'
      ? monthlyChart(projection, {
          events: movementFiltered(query) ? selected : events.filter((e) => matchesEvent(e, query)),
          monthly,
        })
      : undefined;
  return {
    rows,
    report: projection.metadata,
    view: restated?.view ?? postedView(projection),
    facets: baseFacets(events, broad.monthly, query, kind === 'report-details'),
    ...(chart ? { chart } : {}),
  };
}
