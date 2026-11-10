import { listFields, matchedLineFields, type ExportJob, type ExportRequest } from '@wms/contracts';
import { hash } from '../../shared/hash.ts';

export function exportFields(request: ExportRequest) {
  if (request.schema === 'matched_lines' && (request.kind === 'inbound' || request.kind === 'outbound'))
    return matchedLineFields(request.kind);
  return listFields[request.kind];
}

export function newExportJob(request: ExportRequest): ExportJob {
  const now = Date.now();
  const schema = request.schema ?? 'document_summary';
  const format = request.format ?? 'xlsx';
  return {
    id: request.requestId,
    kind: request.kind,
    scope: request.scope,
    schema,
    format,
    state: 'running',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 86_400_000).toISOString(),
    processed: 0,
    total: 0,
    columns: request.columns.map((key) => ({ key, label: exportFields(request).find((f) => f.key === key)!.label })),
    totals: {},
    preview: [],
    error: null,
    errorCode: null,
    sha256: null,
    bytes: 0,
    elapsedMs: 0,
    requestHash: hash(JSON.stringify(request)),
  };
}
