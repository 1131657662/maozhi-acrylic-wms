import {
  webInboundQuerySchema,
  webOutboundQuerySchema,
  webStockQuerySchema,
  webAuditQuerySchema,
  type ExportKind,
  reportQuerySchema,
  reportTurnoverQuerySchema,
  reportAgingQuerySchema,
  type ReportMeta,
  type DerivedReportMeta,
  type ReportView,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { listWebInbound } from '../web-lists/inbound.ts';
import { listWebOutbound } from '../web-lists/outbound.ts';
import { listWebStock } from '../web-lists/stock.ts';
import { listWebAudit } from '../web-lists/audit.ts';
import type { ExportSnapshot, ListReadQuery } from '../web-lists/query.ts';
import type { ExportCursor } from './keyset.ts';
import { reportReader } from '../reports/read.ts';
import { derivedReportReader } from '../reports/derived-read.ts';
import { reportExportReplay } from './report-replay.ts';
import { reportKindSchema } from '@wms/contracts';

export interface ExportPage extends Partial<ReportView> {
  nextCursor?: ExportCursor;
  items: Record<string, unknown>[];
  total: number;
  viewToken: string;
  rowTokens?: Record<string, string>;
  subtotal?: { packages: number; weightGrams: number };
  matchedTotals?: { documentCount: number; lineCount: number; packages: number; weightGrams: number };
  report?: ReportMeta | DerivedReportMeta;
}
export interface ExportBatch {
  after?: ExportCursor;
  size: number;
  snapshot: ExportSnapshot;
}
export function exportReader(
  kind: ExportKind,
  input: Record<string, string>,
  viewToken?: string,
): (db: Database, batch?: ExportBatch) => Promise<ExportPage> {
  const reportKind = reportKindSchema.safeParse(kind);
  if (viewToken && reportKind.success) return reportExportReplay(reportKind.data, input, viewToken);
  switch (kind) {
    case 'report-monthly':
    case 'report-details':
      return reportBatchReader(reportReader(kind, reportQuerySchema.parse(input), viewToken));
    case 'report-turnover':
      return reportBatchReader(derivedReportReader(kind, reportTurnoverQuerySchema.parse(input), viewToken));
    case 'report-aging':
      return reportBatchReader(derivedReportReader(kind, reportAgingQuerySchema.parse(input), viewToken));
    default:
      return listExportReader(kind, input);
  }
}
function listExportReader(kind: Exclude<ExportKind, `report-${string}`>, input: Record<string, string>) {
  switch (kind) {
    case 'inbound':
      return keysetReader(webInboundQuerySchema.parse(input), listWebInbound);
    case 'outbound':
      return keysetReader(webOutboundQuerySchema.parse(input), listWebOutbound);
    case 'stock':
      return keysetReader(webStockQuerySchema.parse(input), listWebStock);
    case 'audit':
      return keysetReader(webAuditQuerySchema.parse(input), listWebAudit);
  }
}

function keysetReader<Q extends { page: number; pageSize: number }>(
  query: Q,
  read: (db: Database, query: ListReadQuery<Q>) => Promise<ExportPage>,
) {
  return async (db: Database, batch?: ExportBatch): Promise<ExportPage> => {
    let nextCursor: ExportCursor | undefined;
    const result = await read(db, {
      ...query,
      page: batch ? 1 : query.page,
      pageSize: batch?.size ?? query.pageSize,
      exportSnapshot: batch?.snapshot,
      exportKeyset: {
        after: batch?.after,
        accept: (cursor) => {
          nextCursor = cursor;
        },
      },
    });
    return { ...result, nextCursor };
  };
}

// Report rows are already frozen in memory by B7a-3. Adapt their array position
// without changing report SQL, snapshot replay or the public list contract.
function reportBatchReader(read: (db: Database, batch?: { page: number; size: number }) => Promise<ExportPage>) {
  return async (db: Database, batch?: ExportBatch): Promise<ExportPage> => {
    const position = batch?.after?.position ?? 0;
    const result = await read(db, batch ? { page: position / batch.size + 1, size: batch.size } : undefined);
    return {
      ...result,
      nextCursor: result.items.length ? { keys: [], position: position + result.items.length } : undefined,
    };
  };
}
