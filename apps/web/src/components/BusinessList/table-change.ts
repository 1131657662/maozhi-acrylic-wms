import { WEB_LIST_DEFAULT_PAGE_SIZE } from '@wms/contracts';
import type { RefObject } from 'react';
import type { TableProps } from 'antd';
import type { ListState } from './use-list-state';

export function tableChange<Row>(
  state: ListState,
  root: RefObject<HTMLDivElement | null>,
): NonNullable<TableProps<Row>['onChange']> {
  return (page, _filters, sorter, extra) => {
    const body = root.current?.querySelector('.ant-table-body');
    if (body && ['sort', 'paginate'].includes(extra.action)) body.scrollTop = 0;
    if (extra.action === 'paginate')
      state.change({ page: String(page.current ?? 1), pageSize: String(page.pageSize ?? WEB_LIST_DEFAULT_PAGE_SIZE) });
    if (extra.action !== 'sort' || Array.isArray(sorter)) return;
    if (!sorter.order) {
      state.change({ page: '1', sortBy: '', direction: '' });
      return;
    }
    const field = Array.isArray(sorter.field) ? sorter.field[0] : sorter.field;
    if (typeof field === 'string')
      state.change({ page: '1', sortBy: field, direction: sorter.order === 'ascend' ? 'asc' : 'desc' });
  };
}
