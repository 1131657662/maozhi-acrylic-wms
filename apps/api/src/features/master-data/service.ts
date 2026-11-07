import { masterItemSchema, masterItemsSchema, type MasterCatalog } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { catalogTable } from './catalogs.ts';

export async function listMasterItems(db: Database, catalog: MasterCatalog) {
  const rows = await db.all(`SELECT code,name,active FROM ${catalogTable(catalog)} ORDER BY code LIMIT 500`);
  return masterItemsSchema.parse(rows.map((row) => ({ ...row, active: Number(row.active) === 1 })));
}
export async function createMasterItem(db: Database, catalog: MasterCatalog, input: { code: string; name: string }, actor: Actor) {
  try {
    return await db.transaction(async (tx) => {
      const now = sqlDate(new Date().toISOString());
      await tx.run(`INSERT INTO ${catalogTable(catalog)}(code,name,active,created_at,updated_at) VALUES(?,?,1,?,?)`,
        [input.code, input.name, now, now]);
      const item = masterItemSchema.parse({ ...input, active: true });
      await audit(tx, actor, { action: 'master.create', targetId: `${catalog}:${input.code}`, before: null, after: item });
      return item;
    });
  } catch (error) {
    if (duplicate(error)) throw new AppError('MASTER_CODE_EXISTS', '主数据编码已存在');
    throw error;
  }
}
export async function updateMasterItem(db: Database, catalog: MasterCatalog, code: string,
  input: { name?: string; active?: boolean }, actor: Actor) {
  return db.transaction(async (tx) => {
    const table = catalogTable(catalog);
    const row = await tx.get(`SELECT code,name,active FROM ${table} WHERE code=? FOR UPDATE`, [code]);
    if (!row) throw new AppError('NOT_FOUND', '主数据不存在', 404);
    const before = masterItemSchema.parse({ ...row, active: Number(row.active) === 1 });
    const after = masterItemSchema.parse({ ...before, ...input });
    await tx.run(`UPDATE ${table} SET name=?,active=?,updated_at=? WHERE code=?`,
      [after.name, Number(after.active), sqlDate(new Date().toISOString()), code]);
    await audit(tx, actor, { action: 'master.update', targetId: `${catalog}:${code}`, before, after });
    return after;
  });
}
function duplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
