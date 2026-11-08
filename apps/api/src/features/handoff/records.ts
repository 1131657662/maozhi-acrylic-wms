import {
  factInputSchema,
  scanContextInputSchema,
  type HandoffRecordInput,
  type ScanContextInput,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure, AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { resolveContext, contextHash } from '../scan/context.ts';
import { handoffHeader } from './read.ts';

export async function registerRecords(db: Database, id: string, records: HandoffRecordInput[]) {
  return db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    const header = await handoffHeader(tx, id);
    for (const input of records)
      await registerOne(tx, { id, deviceId: String(header.device_id), input, sealed: header.confirmed_at !== null });
    const count = Number((await tx.get('SELECT COUNT(*) AS n FROM pda_handoff_records WHERE handoff_id=?', [id]))?.n);
    ensure(count <= Number(header.expected_count), 'HANDOFF_COUNT_MISMATCH', '清单超过登记条数，全部未保存');
    return { registered: count };
  });
}
async function registerOne(
  db: Database,
  args: { id: string; deviceId: string; input: HandoffRecordInput; sealed: boolean },
) {
  const { id, input, deviceId } = args;
  ensure(hash(input.rawPayload) === input.payloadSha, 'HANDOFF_PAYLOAD_MISMATCH', '原正文摘要不符');
  let raw: unknown;
  try {
    raw = JSON.parse(input.rawPayload);
  } catch {
    throw new AppError('VALIDATION_ERROR', '事实正文不是有效 JSON', 422);
  }
  const fact = factInputSchema.parse(raw);
  ensure(fact.deviceId === deviceId, 'HANDOFF_DEVICE_MISMATCH', '队列设备与交接设备不一致');
  const old = await db.get(
    'SELECT payload_sha,plan_id,context_json FROM pda_handoff_records WHERE handoff_id=? AND fact_id=?',
    [id, fact.id],
  );
  if (old) {
    ensure(
      old.payload_sha === input.payloadSha && old.plan_id === input.planId,
      'IDEMPOTENCY_CONFLICT',
      '交接正文不可覆盖',
    );
    if (input.context)
      ensure(
        old.context_json !== null &&
          contextHash(scanContextInputSchema.parse(JSON.parse(String(old.context_json)))) ===
            contextHash(input.context),
        'IDEMPOTENCY_CONFLICT',
        '交接上下文不可覆盖',
      );
    return;
  }
  ensure(!args.sealed, 'HANDOFF_SEALED', '已确认的交接清单不可新增记录');
  const context = await originalContext(db, {
    planId: input.planId,
    fact,
    ...(input.context ? { context: input.context } : {}),
  });
  await db.run(
    `INSERT INTO pda_handoff_records(handoff_id,fact_id,plan_id,raw_payload,payload_sha,body_hash,local_state,context_json)
    VALUES(?,?,?,?,?,?,?,?)`,
    [
      id,
      fact.id,
      input.planId,
      input.rawPayload,
      input.payloadSha,
      hash(JSON.stringify({ planId: input.planId, fact })),
      input.localState,
      context ? JSON.stringify(context) : null,
    ],
  );
}
async function originalContext(
  db: Database,
  input: Parameters<typeof resolveContext>[1],
): Promise<ScanContextInput | null> {
  const existing = await db.get('SELECT * FROM scan_fact_context WHERE fact_id=?', [input.fact.id]);
  if (existing) {
    if (input.context)
      ensure(existing.context_hash === contextHash(input.context), 'IDEMPOTENCY_CONFLICT', '上下文与已收事实不符');
    return {
      outboundLineId: String(existing.outbound_line_id),
      sourceSpec: existing.source_spec === null ? null : String(existing.source_spec),
      resolvedAt:
        existing.resolved_at === null
          ? null
          : new Date(String(existing.resolved_at).replace(' ', 'T') + 'Z').toISOString(),
    };
  }
  try {
    const c = await resolveContext(db, input);
    return { outboundLineId: c.outboundLineId, sourceSpec: c.sourceSpec, resolvedAt: c.resolvedAt };
  } catch (error) {
    if (
      error instanceof AppError &&
      ['FACT_CONTEXT_REQUIRED', 'UNKNOWN_BARCODE', 'WEIGHT_MISMATCH', 'CATALOG_VERSION_UNAVAILABLE'].includes(
        error.code,
      )
    )
      return null;
    throw error;
  }
}
