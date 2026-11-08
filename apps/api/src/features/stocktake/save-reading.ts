import { saveReadingSchema, stocktakeLineSchema, type SaveReading } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { lockCounting } from './window.ts';
import { lineSelect, reading } from './read-model.ts';

interface ReadingCommand {
  id: string;
  productCode: string;
  input: SaveReading;
  key: string;
  actor: Actor;
}
export async function saveReading(db: Database, command: ReadingCommand) {
  const { id, productCode, key, actor } = command;
  const input = saveReadingSchema.parse(command.input),
    payload = { id, productCode, ...input };
  return db.transaction(async (tx) => {
    await tx.get('SELECT id FROM stocktakes WHERE id=? FOR UPDATE', [id]);
    const replay = await replayCommand(tx, 'stocktake.reading', key, payload, actor, stocktakeLineSchema);
    if (replay) return replay;
    await lockCounting(tx, id);
    const row = await tx.get(`${lineSelect} WHERE s.stocktake_id=? AND s.product_code=?`, [id, productCode]);
    ensure(row, 'STOCKTAKE_LINE_MISSING', '商品不在固定盘点范围中');
    const before = reading(row);
    ensure(before.revision === input.expectedRevision, 'STALE_READING', '该行已被修改，输入已保留；请刷新并核对后重试');
    await tx.run(
      `UPDATE stocktake_readings SET packages=?,weight_tonnes=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP(3)
      WHERE stocktake_id=? AND product_code=?`,
      [input.actual.packages, gramsToDecimal(input.actual.weightGrams), actor.username, id, productCode],
    );
    await tx.run('UPDATE stocktakes SET revision=revision+1 WHERE id=?', [id]);
    const after = reading(
      (await tx.get(`${lineSelect} WHERE s.stocktake_id=? AND s.product_code=?`, [id, productCode]))!,
    );
    await audit(tx, actor, { action: 'stocktake.reading', targetId: id, before, after });
    await saveCommand(tx, 'stocktake.reading', key, payload, actor, after);
    return after;
  });
}
