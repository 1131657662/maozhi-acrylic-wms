import { pinyin } from 'pinyin-pro';
import { AppError } from '../../shared/errors.ts';

export const SEARCH_TEXT_MAX_LENGTH = 512;
export const SEARCH_TEXT_BATCH_SIZE = 100;
export const SEARCH_TEXT_TARGETS = {
  products: { table: 'master_products', key: 'code' },
  customers: { table: 'master_customers', key: 'code' },
  suppliers: { table: 'master_suppliers', key: 'code' },
  vehicles: { table: 'master_vehicles', key: 'id' },
} as const;
export type SearchTextCatalog = keyof typeof SEARCH_TEXT_TARGETS;

export function hasSearchText(catalog: string): catalog is SearchTextCatalog {
  return Object.hasOwn(SEARCH_TEXT_TARGETS, catalog);
}

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}]/gu, '');
}

export function buildMasterSearchText(catalog: SearchTextCatalog, row: Record<string, unknown>): string {
  const field = (name: string) => (typeof row[name] === 'string' ? row[name] : '');
  const names = catalog === 'products' ? [field('name'), field('model')] : [field('name')];
  const parts =
    catalog === 'vehicles'
      ? [field('plate_normalized'), field('plate_original')]
      : [
          field('code'),
          ...names,
          ...(catalog === 'products' ? [] : [field('legacy_code')]),
          ...names.flatMap((name) => [
            pinyin(name, { toneType: 'none' }),
            pinyin(name, { pattern: 'first', toneType: 'none' }),
          ]),
        ];
  const text = [...new Set(parts.map(normalizeSearchText).filter(Boolean))].join('');
  if (Array.from(text).length > SEARCH_TEXT_MAX_LENGTH)
    throw new AppError('MASTER_SEARCH_TEXT_TOO_LONG', '名称或型号生成的检索内容过长，请缩短后重试', 422);
  return text;
}
