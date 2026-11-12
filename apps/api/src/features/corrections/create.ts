import { randomUUID } from 'node:crypto';
import { correctionInputSchema, correctionSchema, type CorrectionInput, type CorrectionTarget } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { allocateNumber } from '../document-numbering/service.ts';
import { createOperation, lockInventoryWriter } from '../inventory/operation.ts';
import { postPreparedInventory } from '../inventory/posting.ts';
import { prepareCorrection } from './prepare.ts';
import { readCorrection } from './read.ts';
import { settleCorrectedOutbound } from './settle-outbound.ts';
import { AppError } from '../../shared/errors.ts';

interface Command extends CorrectionTarget {
  input: CorrectionInput;
  key: string;
  actor: Actor;
}
type Prepared = Awaited<ReturnType<typeof prepareCorrection>>;
async function saveHeader(db: Database, command: Command, prepared: Prepared) {
  const id = randomUUID(),
    number = await allocateNumber(db, 'correction');
  const operation = await createOperation(db, 'stock.correct', id, command.input.reason, command.actor);
  const ref = command.kind === 'inbound' ? 'inbound_receipt_id' : 'outbound_order_id';
  await db.run(
    `INSERT INTO document_corrections(id,number,${ref},previous_correction_id,revision,reason,actor,created_at,operation_id)
    VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(3),?)`,
    [
      id,
      number,
      command.id,
      command.input.previousCorrectionId,
      prepared.summary.revision + 1,
      command.input.reason,
      command.actor.username,
      operation.id,
    ],
  );
  return { id, operation };
}
async function saveLines(
  db: Database,
  target: { kind: Command['kind']; correctionId: string },
  lines: Prepared['lines'],
) {
  const ref = target.kind === 'inbound' ? 'inbound_line_id' : 'outbound_line_id';
  for (const line of lines)
    await db.run(
      `INSERT INTO document_correction_lines
    (correction_id,product_code,${ref},original_line_id,packages_before,packages_after,tonnes_before,tonnes_after,packages_delta,tonnes_delta,shipment_line_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [
        target.correctionId,
        line.productCode,
        line.originalLineId,
        line.originalLineId,
        line.before.packages,
        line.after.packages,
        gramsToDecimal(line.before.weightGrams),
        gramsToDecimal(line.after.weightGrams),
        line.delta.packages,
        gramsToDecimal(line.delta.weightGrams),
        line.shipmentLineId,
      ],
    );
}
async function execute(db: Database, command: Command) {
  const prepared = await prepareCorrection(db, command, command.input);
  const { id, operation } = await saveHeader(db, command, prepared);
  await saveLines(db, { kind: command.kind, correctionId: id }, prepared.lines);
  await postPreparedInventory(db, { operation, warehouse: prepared.warehouse, changes: prepared.posted });
  const table = command.kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
  const version = command.kind === 'outbound' ? ',revision=revision+1' : '';
  await db.run(`UPDATE ${table} SET correction_revision=correction_revision+1${version} WHERE id=?`, [command.id]);
  if (command.kind === 'outbound')
    await settleCorrectedOutbound(db, command.id, { before: prepared.state, actor: command.actor });
  const after = await readCorrection(db, id);
  await audit(db, command.actor, { action: 'stock.correct', targetId: id, before: prepared.summary, after });
  return after;
}
export async function createCorrection(db: Database, command: Command) {
  const input = correctionInputSchema.parse(command.input);
  if (new Set(input.lines.map((l) => l.originalLineId)).size !== input.lines.length)
    throw new AppError('CORRECTION_ORDER_LINE_DUPLICATE', '该订单行在本单已更正，请为另一批发货另开更正单', 422);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const scope = 'correction.create',
      payload = { kind: command.kind, id: command.id, ...input };
    const previous = await replayCommand(tx, scope, command.key, payload, command.actor, correctionSchema);
    if (previous) return previous;
    const result = await execute(tx, { ...command, input });
    await saveCommand(tx, scope, command.key, payload, command.actor, result);
    return result;
  });
}
