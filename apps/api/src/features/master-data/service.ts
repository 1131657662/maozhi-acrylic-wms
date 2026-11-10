import type { MasterCatalog, CreateMasterItem, UpdateMasterItem } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { catalogTable, activeMaster } from './catalogs.ts';
import { editableColumns, validateMasterFields, masterItem } from './fields.ts';
import { assertMasterUnused } from './references.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { readMasterItem } from './read.ts';
export { listMasterItems, readMasterItem } from './read.ts';

async function saveFields(
  db: Database,
  target: { catalog: MasterCatalog; code: string },
  input: CreateMasterItem | UpdateMasterItem,
) {
  const { catalog, code } = target;
  if (catalog === 'products' && input.categoryCode) await activeMaster(db, 'categories', input.categoryCode);
  const values: (string | number | null)[] = [],
    assignments: string[] = [];
  for (const [field, column] of Object.entries(editableColumns[catalog])) {
    const value = input[field as keyof typeof input];
    if (value !== undefined) {
      assignments.push(`${column}=?`);
      values.push(typeof value === 'boolean' ? Number(value) : value);
    }
  }
  if (assignments.length)
    await db.run(`UPDATE ${catalogTable(catalog)} SET ${assignments.join(',')} WHERE code=?`, [...values, code]);
}
export async function createMasterItem(db: Database, catalog: MasterCatalog, input: CreateMasterItem, actor: Actor) {
  validateMasterFields(catalog, input);
  try {
    return await db.transaction(async (tx) => {
      await lockInventoryWriter(tx);
      await tx.run(
        `INSERT INTO ${catalogTable(catalog)}(code,name,active,created_at,updated_at) VALUES(?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
        [input.code, input.name],
      );
      if (catalog === 'products')
        await tx.run("UPDATE master_products SET origin_kind='local',inventory_eligible=1 WHERE code=?", [input.code]);
      await saveFields(tx, { catalog, code: input.code }, input);
      const after = await readMasterItem(tx, catalog, input.code);
      await audit(tx, actor, { action: 'master.create', targetId: `${catalog}:${input.code}`, before: null, after });
      return after;
    });
  } catch (error) {
    return masterWriteError(error);
  }
}
export async function updateMasterItem(
  db: Database,
  catalog: MasterCatalog,
  code: string,
  input: UpdateMasterItem,
  actor: Actor,
) {
  validateMasterFields(catalog, input);
  try {
    return await db.transaction(async (tx) => {
      await lockInventoryWriter(tx);
      const row = await tx.get(`SELECT * FROM ${catalogTable(catalog)} WHERE code=? AND source_del_flag=0 FOR UPDATE`, [
        code,
      ]);
      if (!row) throw new AppError('NOT_FOUND', '资料不存在', 404);
      if (catalog === 'products' && row.source_kind === 'sku-spec')
        throw new AppError('PRODUCT_CATALOG_ONLY', '条码目录规格不能作为库存商品维护', 422);
      const before = masterItem(row, catalog);
      if (input.active === false) await assertMasterUnused(tx, catalog, code);
      if (
        catalog === 'categories' &&
        input.active === false &&
        (await tx.get('SELECT code FROM master_products WHERE category_code=? LIMIT 1', [code]))
      )
        throw new AppError('CATEGORY_IN_USE', '分类已被商品引用，不能停用', 422);
      await tx.run(`UPDATE ${catalogTable(catalog)} SET name=?,active=?,updated_at=UTC_TIMESTAMP(3) WHERE code=?`, [
        input.name ?? before.name,
        Number(input.active ?? before.active),
        code,
      ]);
      await saveFields(tx, { catalog, code }, input);
      const after = await readMasterItem(tx, catalog, code);
      await audit(tx, actor, { action: 'master.update', targetId: `${catalog}:${code}`, before, after });
      return after;
    });
  } catch (error) {
    return masterWriteError(error);
  }
}
function masterWriteError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'ER_DUP_ENTRY') throw new AppError('MASTER_CODE_EXISTS', '主数据编码已存在', 422);
    if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED')
      throw new AppError('MASTER_FIELD_INVALID', '资料字段或库存预警范围不正确', 422);
  }
  throw error;
}
