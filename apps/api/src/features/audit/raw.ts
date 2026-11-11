import { AUDIT_RAW_PREVIEW_BYTES, AUDIT_DIAGNOSTIC_BYTES, AUDIT_EVENT_PAGE_SIZE } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { auditRecord, recordTrace, tracePredicate, eventPage, assertRecordLimit } from './records.ts';
import { assertBytes, rawRows } from './raw-storage.ts';
export async function readRaw(
  db: Database,
  id: string,
  query: { traceId?: string; cursor?: string; pageSize: number },
) {
  return db.readSnapshot(async (tx) => {
    const row = await auditRecord(tx, id),
      traceId = await recordTrace(tx, row);
    if (query.traceId !== undefined && query.traceId !== traceId)
      throw new AppError('NOT_FOUND', '关联记录不存在', 404);
    const page =
      query.traceId === undefined
        ? { rows: [row], total: 1, nextCursor: null }
        : await eventPage(tx, tracePredicate(traceId), query.cursor, query.pageSize);
    assertRecordLimit(page.total);
    const result = {
      items: await rawRows(tx, page.rows, AUDIT_RAW_PREVIEW_BYTES),
      total: page.total,
      nextCursor: page.nextCursor,
      traceId,
    };
    assertBytes(Buffer.byteLength(JSON.stringify(result)), AUDIT_RAW_PREVIEW_BYTES);
    return result;
  });
}
export interface DiagnosticHooks {
  beforeRead?: () => void | Promise<void>;
  afterPage?: () => void | Promise<void>;
}
export async function traceDiagnostic(
  db: Database,
  id: string,
  signal?: AbortSignal,
  hooks: DiagnosticHooks = {},
): Promise<Buffer> {
  return db.readSnapshot(async (tx) => {
    const row = await auditRecord(tx, id),
      traceId = await recordTrace(tx, row),
      predicate = tracePredicate(traceId);
    const chunks: Buffer[] = [Buffer.from('{"records":[')];
    let bytes = chunks[0]!.length,
      count = 0,
      cursor: string | undefined;
    do {
      signal?.throwIfAborted();
      await hooks.beforeRead?.();
      const page = await eventPage(tx, predicate, cursor, AUDIT_EVENT_PAGE_SIZE);
      assertRecordLimit(page.total);
      for (const record of await rawRows(tx, page.rows, AUDIT_DIAGNOSTIC_BYTES - bytes)) {
        const chunk = Buffer.from(`${count ? ',' : ''}${JSON.stringify(record)}`);
        bytes += chunk.length;
        assertBytes(bytes, AUDIT_DIAGNOSTIC_BYTES);
        chunks.push(chunk);
        count++;
      }
      cursor = page.nextCursor ?? undefined;
      await hooks.afterPage?.();
    } while (cursor);
    signal?.throwIfAborted();
    const tail = Buffer.from(`],"count":${count}}`);
    assertBytes(bytes + tail.length, AUDIT_DIAGNOSTIC_BYTES);
    return Buffer.concat([...chunks, tail]);
  });
}
