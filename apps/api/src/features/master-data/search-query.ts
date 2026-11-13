import type { MasterCatalog, MasterListQuery } from '@wms/contracts';
import { hasSearchText, normalizeSearchText } from './search-text.ts';

export function likePattern(value: string): string {
  return `%${value.replace(/[!%_]/g, '!$&')}%`;
}

export function masterListPredicate(catalog: MasterCatalog, query: MasterListQuery) {
  const clauses = ['source_del_flag=0'];
  const values: string[] = [];
  if (catalog === 'products') clauses.push("source_kind<>'sku-spec'");
  if (catalog === 'products' && query.scope === 'inventory') clauses.push('inventory_eligible=1');
  const keyword = query.q ?? query.keyword;
  if (keyword) {
    const normalized = normalizeSearchText(keyword);
    const searchText = hasSearchText(catalog) && normalized !== '';
    clauses.push(
      `(${searchText ? "search_text LIKE ? ESCAPE '!' OR " : ''}code LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!')`,
    );
    if (searchText) values.push(likePattern(normalized));
    values.push(likePattern(keyword), likePattern(keyword));
  }
  if (query.status !== 'all') clauses.push(`active=${query.status === 'active' ? 1 : 0}`);
  return { sql: clauses.join(' AND '), values };
}
