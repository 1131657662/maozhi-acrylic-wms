import { scanBatchResultSchema, type ScanBatchInput, type ScanRecordResult } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { withCommandAttempt } from '../audit/command.ts';
import { addScanRecord } from './record.ts';

export async function addScanBatch(db: Database, id: string, input: ScanBatchInput, key: string, actor: Actor) {
  const items: ScanRecordResult[] = [];
  const batchHash = hash(JSON.stringify(input));
  for (const [index, item] of input.records.entries()) {
    const entry = { ...item, source: input.source };
    try {
      items.push(
        await withCommandAttempt(
          db,
          { action: 'scan.record', targetKind: 'outbound', targetId: id, actor, channel: 'web', input: entry },
          () => addScanRecord(db, id, entry, `${key}:${index}`, actor, batchHash),
        ),
      );
    } catch (error) {
      items.push({
        ...item,
        ok: false,
        reason: error instanceof AppError ? error.message : '处理结果待核实，请刷新记录后重试',
      });
    }
  }
  return scanBatchResultSchema.parse({ items });
}
