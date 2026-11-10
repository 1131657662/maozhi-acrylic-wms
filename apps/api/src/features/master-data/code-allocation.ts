import { MASTER_CODE_RULES, NUMBER_CAPACITY_MESSAGE, type GeneratedMasterCatalog } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { catalogTable } from './catalogs.ts';

export function duplicateCode(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

// The caller owns the creation transaction and inventory identity lock.
export async function insertGeneratedMaster(db: Database, catalog: GeneratedMasterCatalog, name: string) {
  const rule = MASTER_CODE_RULES[catalog];
  await db.run('INSERT IGNORE INTO master_code_counters(prefix,`last_value`) VALUES(?,0)', [rule.prefix]);
  const row = await db.get('SELECT `last_value` FROM master_code_counters WHERE prefix=? FOR UPDATE', [rule.prefix]);
  let sequence = Number(row!.last_value);
  while (sequence < rule.capacity) {
    sequence += 1;
    const code = rule.prefix + String(sequence).padStart(rule.width, '0');
    await db.run('UPDATE master_code_counters SET `last_value`=? WHERE prefix=?', [sequence, rule.prefix]);
    try {
      await db.run(
        `INSERT INTO ${catalogTable(catalog)}(code,name,active,created_at,updated_at) VALUES(?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
        [code, name],
      );
      return code;
    } catch (error) {
      if (!duplicateCode(error)) throw error;
    }
  }
  throw new AppError('MASTER_CODE_EXHAUSTED', NUMBER_CAPACITY_MESSAGE, 422);
}
