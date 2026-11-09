import { changeBusinessDateSchema, type CorrectionTarget } from '@wms/contracts';
import { z } from 'zod';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { validateBusinessDate } from './policy.ts';

const resultSchema = z.object({ businessDate: z.string() });
interface DateCommand extends CorrectionTarget {
  input: unknown;
  key: string;
  actor: Actor;
}
async function change(db: Database, command: DateCommand) {
  const table = command.kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
  const row = await db.get(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [command.id]);
  if (!row) throw new AppError('NOT_FOUND', '单据不存在', 404);
  if (
    row.source_id !== null ||
    row.source_del_flag !== 0 ||
    (command.kind === 'inbound' ? row.posting_state !== 'pending' : row.status !== 'open')
  )
    throw new AppError('BUSINESS_DATE_LOCKED', '该单业务日期已锁定，不能直接修改；入账后须走日期更正', 422);
  const validated = validateBusinessDate(changeBusinessDateSchema.parse(command.input));
  const revision = command.kind === 'outbound' ? ',revision=revision+1' : '';
  await db.run(`UPDATE ${table} SET business_date=?${revision} WHERE id=?`, [validated.businessDate, command.id]);
  await audit(db, command.actor, {
    action: `business-date.${command.kind}`,
    targetId: command.id,
    before: { businessDate: row.business_date },
    after: validated,
  });
  return { businessDate: validated.businessDate };
}
export async function changeBusinessDate(db: Database, command: DateCommand) {
  const input = changeBusinessDateSchema.parse(command.input);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const scope = `business-date.${command.kind}`,
      payload = { id: command.id, ...input };
    const previous = await replayCommand(tx, scope, command.key, payload, command.actor, resultSchema);
    if (previous) return previous;
    const result = await change(tx, { ...command, input });
    await saveCommand(tx, scope, command.key, payload, command.actor, result);
    return result;
  });
}
