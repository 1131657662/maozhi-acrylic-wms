import { useSearchParams } from '@umijs/max';
import type { ListParams } from '../../features/web-lists/keys';

export function useListState(defaultSort = 'createdAt', fixed: ListParams = {}, defaults: ListParams = {}) {
  const [search, setSearch] = useSearchParams();
  const params: ListParams & { page: string; pageSize: string; sortBy: string; direction: string } = {
    page: '1',
    pageSize: '20',
    sortBy: defaultSort,
    direction: defaultSort === 'warehouseCode' ? 'asc' : 'desc',
    ...defaults,
    ...Object.fromEntries(search),
    ...fixed,
  };
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
        pageSize: params.pageSize,
        sortBy: params.sortBy,
        direction: params.direction,
      }),
    );
  }
  return { params, change, searchFor, reset: () => setSearch(new URLSearchParams({ ...defaults, ...fixed })) };
}
export type ListState = ReturnType<typeof useListState>;
