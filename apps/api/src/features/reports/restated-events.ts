import { z } from 'zod';
import type { ReportQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { LedgerEvent, Projection } from './types.ts';
import { dimensionFilter, ledgerFields, ledgerFrom } from './sql.ts';
import { normalizeEvent } from './normalize.ts';
import { REPORT_BATCH_SIZE, snapshotLocalTime, type ReportSnapshot } from './snapshot.ts';
import { reportCopy } from './copy.ts';

export interface DatedEvent extends LedgerEvent {
  effectiveBusinessDate: string | null;
  reportingDate: string | null;
  dateReason: string;
}
function businessDay(value: string | null): string | null {
  const result = z.iso.date().safeParse(value);
  return result.success ? result.data : null;
}
function effectiveDates(snapshot: ReportSnapshot): Map<string, string> {
  const latest = new Map<string, string>();
  for (const row of snapshot.corrections) latest.set(JSON.stringify([row.documentKind, row.documentId]), row.afterDate);
  return latest;
}
function datedEvent(event: LedgerEvent, dates: Map<string, string>): DatedEvent {
  if (event.family !== 'inbound' && event.family !== 'outbound')
    return {
      ...event,
      effectiveBusinessDate: null,
      reportingDate: event.localTime?.slice(0, 10) ?? null,
      dateReason: reportCopy.postedException,
    };
  const original = businessDay(event.businessDate);
  const corrected = event.documentId ? dates.get(JSON.stringify([event.family, event.documentId])) : undefined;
  const effectiveBusinessDate = original ? (corrected ?? original) : null;
  return {
    ...event,
    effectiveBusinessDate,
    reportingDate: effectiveBusinessDate,
    dateReason: effectiveBusinessDate ? '' : reportCopy.missingBusinessDate,
  };
}
export async function readDatedEvents(db: Database, query: ReportQuery, projection: Projection): Promise<DatedEvent[]> {
  const filter = dimensionFilter(query),
    snapshot = projection.snapshot;
  const dates = effectiveDates(snapshot),
    events: DatedEvent[] = [],
    cutoff = snapshotLocalTime(snapshot);
  let cursor = 0;
  for (;;) {
    const rows = await db.all(
      `SELECT ${ledgerFields} ${ledgerFrom}
      WHERE s.id>? AND s.id<=? ${filter.sql} ORDER BY s.id LIMIT ?`,
      [cursor, snapshot.watermarks.journalMaxId, ...filter.values, REPORT_BATCH_SIZE],
    );
    if (!rows.length) return events;
    for (const row of rows) {
      const event = normalizeEvent(row);
      cursor = event.sequence;
      if (!event.deleted && (!event.localTime || event.localTime <= cutoff)) events.push(datedEvent(event, dates));
    }
  }
}
export function dayInRange(day: string | null, query: Pick<ReportQuery, 'fromDay' | 'toDay'>): boolean {
  return day !== null && day >= query.fromDay && day <= query.toDay;
}
