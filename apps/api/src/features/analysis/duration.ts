import type { AnalysisQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { shiftDay } from '../reports/derived-common.ts';
import type { ReportSnapshot } from '../reports/snapshot.ts';
import { businessText } from '../audit/projection.ts';
import { analysisCopy as copy } from './copy.ts';
import { durationQuery } from './duration-query.ts';

const exclusionReasons = [
  ['inbound', 'inboundReversed', copy.excludedInboundReversed],
  ['inbound', 'inboundVoided', copy.excludedInboundVoided],
  ['outbound', 'outboundReversed', copy.excludedOutboundReversed],
  ['outbound', 'outboundVoided', copy.excludedOutboundVoided],
  ['outbound', 'outboundUnshipped', copy.excludedOutboundUnshipped],
] as const;

function utcBoundary(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 8 * 3_600_000).toISOString().replace('T', ' ').slice(0, 23);
}

function elapsedHours(createdAt: string, asOf: string): number {
  return Math.round(Math.max(0, (Date.parse(asOf) - Date.parse(createdAt)) / 3_600_000) * 10) / 10;
}

function oldestPending(row: Row, asOf: string) {
  if (!row.pendingCreatedAt) return null;
  const createdAt = isoDate(row.pendingCreatedAt);
  return {
    kind: row.pendingKind === 'inbound' ? ('inbound' as const) : ('outbound' as const),
    number: businessText(row.pendingNumber, '单号未记录'),
    createdAt,
    elapsedHours: elapsedHours(createdAt, asOf),
  };
}

export async function durationSummary(db: Database, query: AnalysisQuery, snapshot: ReportSnapshot) {
  const start = utcBoundary(query.fromDay),
    end = utcBoundary(shiftDay(query.toDay, 1)),
    asOf = snapshot.watermarks.asOf.replace('T', ' ').replace('Z', '');
  const period = [start, end, asOf],
    cutoff = [end, asOf];
  const row = await db.get(durationQuery, [...period, asOf, asOf, ...period, ...period, ...cutoff, ...cutoff]);
  return {
    inboundAverageHours:
      row?.inboundAverageHours == null || Number(row.inboundMissing) > 0 ? null : Number(row.inboundAverageHours),
    inboundCompleted: Number(row?.inboundCompleted ?? 0),
    outboundAverageHours:
      row?.outboundAverageHours == null || Number(row.outboundMissing) > 0 ? null : Number(row.outboundAverageHours),
    outboundCompleted: Number(row?.outboundCompleted ?? 0),
    longestPending: row ? oldestPending(row, snapshot.watermarks.asOf) : null,
    missingEvidence: Number(row?.inboundMissing ?? 0) + Number(row?.outboundMissing ?? 0),
    exclusions: exclusionReasons.map(([kind, key, reason]) => ({
      kind,
      reason,
      count: Number(row?.[key] ?? 0),
      undatedCount: Number(row?.[`${key}Undated`] ?? 0),
    })),
  };
}
