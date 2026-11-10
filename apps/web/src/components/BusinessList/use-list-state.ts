import { useSearchParams } from '@umijs/max';
import { WEB_LIST_DEFAULT_PAGE_SIZE } from '@wms/contracts';
import type { ListParams } from '../../features/web-lists/keys';

export function useListState(
  defaultSort = 'createdAt',
  fixed: ListParams = {},
  defaults: ListParams = {},
  omitted: string[] = [],
) {
  const [search, setSearch] = useSearchParams();
  const params: ListParams & { page: string; pageSize: string; sortBy: string; direction: string } = {
    page: '1',
    pageSize: String(WEB_LIST_DEFAULT_PAGE_SIZE),
    sortBy: defaultSort,
    direction: defaultSort === 'warehouseCode' ? 'asc' : 'desc',
    ...defaults,
    ...Object.fromEntries(search),
    ...fixed,
  };
  for (const key of omitted) delete params[key];
  function change(patch: ListParams) {
    const next = { ...params, ...patch };
    setSearch(new URLSearchParams(Object.entries(next).filter(([key, value]) => key === 'status' || value !== '')));
  }
  function searchFor(filters: ListParams) {
    setSearch(
      new URLSearchParams({
        ...filters,
        ...fixed,
        page: '1',
        pageSize: filters.pageSize ?? params.pageSize,
        sortBy: filters.sortBy ?? params.sortBy,
        direction: filters.direction ?? params.direction,
      }),
    );
  }
  return { params, change, searchFor, reset: () => setSearch(new URLSearchParams({ ...defaults, ...fixed })) };
}
export type ListState = ReturnType<typeof useListState>;
