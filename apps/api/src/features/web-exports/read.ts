import {
  webInboundQuerySchema,
  webOutboundQuerySchema,
  webStockQuerySchema,
  webAuditQuerySchema,
  type ExportKind,
  reportQuerySchema,
  type ReportMeta,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { listWebInbound } from '../web-lists/inbound.ts';
import { listWebOutbound } from '../web-lists/outbound.ts';
import { listWebStock } from '../web-lists/stock.ts';
import { listWebAudit } from '../web-lists/audit.ts';
import type { ExportSnapshot } from '../web-lists/query.ts';
import { reportReader } from '../reports/read.ts';

export interface ExportPage {
  items: Record<string, unknown>[];
  total: number;
  viewToken: string;
  rowTokens?: Record<string, string>;
  subtotal?: { packages: number; weightGrams: number };
  report?: ReportMeta;
}
export interface ExportBatch {
  page: number;
  size: number;
  snapshot: ExportSnapshot;
}
export function exportReader(
  kind: ExportKind,
  input: Record<string, string>,
): (db: Database, batch?: ExportBatch) => Promise<ExportPage> {
  switch (kind) {
    case 'report-monthly':
    case 'report-details':
      return reportReader(kind, reportQuerySchema.parse(input));
    case 'inbound': {
      const q = webInboundQuerySchema.parse(input);
      return (db: Database, batch?: ExportBatch) =>
        listWebInbound(db, {
          ...q,
          page: batch?.page ?? q.page,
          pageSize: batch?.size ?? q.pageSize,
          exportSnapshot: batch?.snapshot,
        });
    }
    case 'outbound': {
      const q = webOutboundQuerySchema.parse(input);
      return (db: Database, batch?: ExportBatch) =>
        listWebOutbound(db, {
          ...q,
          page: batch?.page ?? q.page,
          pageSize: batch?.size ?? q.pageSize,
          exportSnapshot: batch?.snapshot,
        });
    }
    case 'stock': {
      const q = webStockQuerySchema.parse(input);
      return (db: Database, batch?: ExportBatch) =>
        listWebStock(db, {
          ...q,
          page: batch?.page ?? q.page,
          pageSize: batch?.size ?? q.pageSize,
          exportSnapshot: batch?.snapshot,
        });
    }
    case 'audit': {
      const q = webAuditQuerySchema.parse(input);
      return (db: Database, batch?: ExportBatch) =>
        listWebAudit(db, {
          ...q,
          page: batch?.page ?? q.page,
          pageSize: batch?.size ?? q.pageSize,
          exportSnapshot: batch?.snapshot,
        });
    }
  }
}
