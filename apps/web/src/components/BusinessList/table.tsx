import type { Key } from 'react';
import { Button } from 'antd';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import type { ListState } from './use-list-state';

export interface ListData<Row> {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
}
interface Props<Row> {
  columns: ProColumns<Row>[];
  data: ListData<Row>;
  state: ListState;
  name: string;
  refreshing: boolean;
  reload: () => unknown;
  selection: { keys: Key[]; change: (keys: Key[]) => void };
}
export function ListTable<Row extends { id: Key }>(props: Props<Row>) {
  const { keys: selected, change: setSelected } = props.selection;
  const { columns, data, state, name } = props;
  const configured = columns.map((column) => ({
    ...column,
    sortOrder:
      column.dataIndex === state.params.sortBy
        ? ((state.params.direction === 'asc' ? 'ascend' : 'descend') as 'ascend' | 'descend')
        : null,
  }));
  return (
    <ProTable<Row>
      rowKey="id"
      columns={configured}
      dataSource={data.items}
      search={false}
      sortDirections={['ascend', 'descend', 'ascend']}
      headerTitle={`查询结果 · ${data.total} 条`}
      loading={props.refreshing}
      size="middle"
      options={{
        density: false,
        fullScreen: false,
        reload: () => {
          props.reload();
        },
        setting: { draggable: true },
      }}
      columnsState={{ persistenceKey: `b1b-${name}-columns-v1`, persistenceType: 'localStorage' }}
      scroll={{ x: 'max-content', y: 480 }}
      locale={{ emptyText: '没有符合条件的记录，可调整筛选条件或重置后重试' }}
      rowSelection={{
        selectedRowKeys: selected,
        onChange: setSelected,
        preserveSelectedRowKeys: true,
        columnWidth: 48,
      }}
      tableAlertRender={() => <span role="status">已选择 {selected.length} 条；变更筛选将清空选择</span>}
      tableAlertOptionRender={() => (
        <Button type="link" onClick={() => setSelected([])}>
          清空选择
        </Button>
      )}
      pagination={{
        current: data.page,
        pageSize: data.pageSize,
        total: data.total,
        showSizeChanger: true,
        pageSizeOptions: [20, 50, 100, 200],
        showTotal: (total) => `共 ${total} 条`,
      }}
      onChange={(page, _filters, sorter, extra) => {
        if (extra.action === 'paginate')
          state.change({ page: String(page.current ?? 1), pageSize: String(page.pageSize ?? 20) });
        if (extra.action === 'sort' && !Array.isArray(sorter)) {
          const field = Array.isArray(sorter.field) ? sorter.field[0] : sorter.field;
          if (typeof field === 'string')
            state.change({ page: '1', sortBy: field, direction: sorter.order === 'ascend' ? 'asc' : 'desc' });
        }
      }}
    />
  );
}
