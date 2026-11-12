import { randomUUID } from 'node:crypto';
import {
  dateCorrectionInputSchema,
  dateCorrectionSchema,
  type CorrectionTarget,
  type DateCorrection,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError, ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { validateBusinessDate } from '../business-date/policy.ts';
import { dateCorrectionDocument, readDateCorrections } from './read.ts';

interface Command extends CorrectionTarget {
  input: unknown;
  key: string;
  actor: Actor;
}
async function append(db: Database, record: DateCorrection) {
  await db.run(
    `INSERT INTO document_date_corrections
    (id,document_kind,document_id,previous_correction_id,before_date,after_date,reason,actor,operation_id,created_at,revision)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [
      record.id,
      record.documentKind,
      record.documentId,
      record.previousCorrectionId,
      record.beforeDate,
      record.afterDate,
      record.reason,
      record.actor,
      record.operationId,
      sqlDate(record.createdAt),
      record.revision,
    ],
  );
}
async function correct(db: Database, command: Command) {
  const row = await dateCorrectionDocument(db, command, true);
  const current = await readDateCorrections(db, command);
  if (!current.allowed) throw new AppError('DATE_CORRECTION_FORBIDDEN', current.blockedReason!, 422);
  const input = dateCorrectionInputSchema.parse(command.input);
  ensure(input.expectedRevision === current.revision, 'STALE_DATE_CORRECTION', '业务日期已被更正，请重新打开抽屉核对');
  const validated = validateBusinessDate({ businessDate: input.afterDate, backdateConfirmed: input.backdateConfirmed });
  const record = dateCorrectionSchema.parse({
    id: randomUUID(),
    documentKind: command.kind,
    documentId: command.id,
    previousCorrectionId: current.records.at(-1)?.id ?? null,
    beforeDate: current.effectiveBusinessDate,
    afterDate: input.afterDate,
    reason: input.reason,
    actor: command.actor.username,
    operationId: randomUUID(),
    createdAt: new Date().toISOString(),
    revision: current.revision + 1,
  });
  await append(db, record);
  await audit(db, command.actor, {
    action: `date-correction.${command.kind}`,
    targetId: command.id,
    before: { businessDate: record.beforeDate },
    after: {
      businessDate: record.afterDate,
      reason: record.reason,
      dateCorrectionId: record.id,
      revision: record.revision,
      operationId: record.operationId,
      businessDateConfirmation: validated,
      ...(command.kind === 'inbound' ? { receiptNo: row.receipt_no } : { orderNo: row.order_no }),
    },
  });
  return record;
}
export async function createDateCorrection(db: Database, command: Command) {
  const input = dateCorrectionInputSchema.parse(command.input);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const scope = 'date-correction.create',
      payload = { kind: command.kind, id: command.id, ...input };
    const previous = await replayCommand(tx, scope, command.key, payload, command.actor, dateCorrectionSchema);
    if (previous) return previous;
    const record = await correct(tx, { ...command, input });
    await saveCommand(tx, scope, command.key, payload, command.actor, record);
    return record;
  });
}
