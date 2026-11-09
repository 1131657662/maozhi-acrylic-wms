import type { ExportKind } from '@wms/contracts';
import { useListColumns } from './use-list-columns';
import { ExportPanel } from '../../features/web-exports/panel';
import { useMemo, type Key, type ReactNode } from 'react';
import { Button } from 'antd';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import type { ListState } from './use-list-state';

export interface ListData<Row> {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  viewToken?: string;
  rowTokens?: Record<string, string>;
}
interface Props<Row> {
  columns: ProColumns<Row>[];
  data: ListData<Row>;
  state: ListState;
  name: ExportKind;
  refreshing: boolean;
  reload: () => unknown;
  selection: { tokens: Record<string, string>; keys: Key[]; change: (keys: Key[]) => void };
  emptyText?: ReactNode;
}
export function ListTable<Row extends { id: Key }>(props: Props<Row>) {
  const { keys: selected, change: setSelected } = props.selection;
  const { columns, data, state, name } = props;
  const columnPrefs = useListColumns(name, columns);
  const configured = useMemo(
    () =>
      columnPrefs.configured.map((column) => ({
        ...column,
        sortOrder:
          column.dataIndex === state.params.sortBy
            ? ((state.params.direction === 'asc' ? 'ascend' : 'descend') as 'ascend' | 'descend')
            : null,
      })),
    [columnPrefs.configured, state.params.sortBy, state.params.direction],
  );
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
      columnsState={columnPrefs.state}
      toolBarRender={() => [
        <ExportPanel
          key="export"
          refreshing={props.refreshing}
          context={{
            kind: name,
            query: state.params,
            columns: columnPrefs.visible,
            viewToken: data.viewToken ?? '',
            selected: selected.map((id) => ({ id: String(id), token: props.selection.tokens[String(id)] ?? '' })),
            total: data.total,
            pageCount: data.items.length,
          }}
        />,
      ]}
      scroll={{ x: 'max-content', y: 480 }}
      locale={{ emptyText: props.emptyText ?? '没有符合条件的记录，可调整筛选条件或重置后重试' }}
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
