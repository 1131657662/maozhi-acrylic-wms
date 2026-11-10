import { randomUUID } from 'node:crypto';
import { matchedLineFields, type ExportRequest } from '@wms/contracts';

export function matchedRequest(page: Record<string, any>, format: 'xlsx' | 'csv'): ExportRequest {
  const query = {
    keyword: 'WL-RK-',
    productCodes: 'WL-P000130',
    productMode: 'any',
    from: '2026-11-01T00:00:00+08:00',
    to: '2026-11-30T23:59:59.999+08:00',
    page: '1',
    pageSize: '50',
    sortBy: 'receiptNo',
    direction: 'asc',
  };
  return {
    requestId: randomUUID(),
    kind: 'inbound',
    scope: 'all',
    schema: 'matched_lines',
    format,
    query,
    columns: matchedLineFields('inbound').map((field) => field.key),
    viewToken: page.viewToken,
    selected: [],
  };
}
