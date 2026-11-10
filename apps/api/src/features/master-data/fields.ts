import type { MasterCatalog, MasterItem } from '@wms/contracts';
import { masterItemSchema } from '@wms/contracts';
import type { Row } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';

const productFields = {
  model: 'model',
  categoryCode: 'category_code',
  packageType: 'package_type',
  packageColor: 'package_color',
  strapColor: 'strap_color',
  minAlertTonnes: 'min_alert_tonnes',
  maxAlertTonnes: 'max_alert_tonnes',
  memo: 'memo',
};
export const editableColumns: Record<MasterCatalog, Record<string, string>> = {
  products: productFields,
  categories: {},
  warehouses: { contact: 'contact', phone: 'phone', address: 'address', memo: 'memo' },
  customers: { memo: 'memo' },
  suppliers: { memo: 'memo' },
};
export function validateMasterFields(catalog: MasterCatalog, input: object): void {
  const allowed = new Set(['code', 'name', 'active', ...Object.keys(editableColumns[catalog])]);
  if (Object.keys(input).some((key) => !allowed.has(key)))
    throw new AppError('MASTER_FIELD_INVALID', '该类资料不支持这些字段；往来联系人请使用收送货档案', 422);
}
export function masterItem(row: Row, catalog: MasterCatalog): MasterItem {
  const extra: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(editableColumns[catalog]))
    extra[field] = field.endsWith('AlertTonnes') && row[column] !== null ? Number(row[column]) : row[column];
  if (catalog === 'products') {
    extra.originKind = row.origin_kind;
    extra.inventoryEligible = Number(row.inventory_eligible) === 1;
  }
  if (['customers', 'suppliers', 'warehouses'].includes(catalog)) extra.legacyCode = row.legacy_code ?? null;
  return masterItemSchema.parse({ code: row.code, name: row.name, active: Number(row.active) === 1, ...extra });
}
