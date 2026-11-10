import { WEB_LIST_PAGE_SIZES, tonnes } from '@wms/contracts';
import type { ListTableProps } from './table-types';
export type { ListData } from './table-types';
import { ListExportPanel } from './list-export';
import { ColumnReset } from './column-reset';
import { useColumnLayout } from './use-column-layout';
import { ResizeEnabled, ResizeHeader } from './resize-header';
import { useMatchedExpansion } from './use-matched-expansion';
import { COLUMN_WIDTH } from './column-settings';
import { useMemo, type Key, type KeyboardEvent, type MouseEvent } from 'react';
import { Button, ConfigProvider, theme } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import { useLocation, useNavigate } from '@umijs/max';
import { BatchReverseActions, type BatchRow } from './batch-actions';
import type { ListSelectionRow } from './use-list-selection';
import { documentNumber, isEligible, exclusionReason, isInteractiveTarget, isTextEntry } from './table-helpers';

export function ListTable<Row extends { id: Key }>(props: ListTableProps<Row>) {
  const { keys: selected, change: setSelected } = props.selection;
  const { data, state, name, columnPrefs } = props;
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const configured = useMemo(
    () =>
      columnPrefs.configured
        .filter((column) => column.dataIndex !== 'matchedSummary' || Boolean(state.params.productCodes))
        .map((column) => ({
          ...column,
          sortOrder:
            state.hasExplicitSort && column.dataIndex === state.params.sortBy
              ? ((state.params.direction === 'asc' ? 'ascend' : 'descend') as 'ascend' | 'descend')
              : null,
        })),
    [
      columnPrefs.configured,
      state.params.productCodes,
      state.params.sortBy,
      state.params.direction,
      state.hasExplicitSort,
    ],
  );
  const reverseLookup = name === 'inbound' || name === 'outbound';
  const lifecycleKind = reverseLookup ? name : null;
  const selectedRows = data.items.filter((row) => selected.includes(row.id));
  const currentSelectionRows: ListSelectionRow[] = data.items.map((row) => ({
    id: row.id,
    number: documentNumber(name, row),
    eligible: isEligible(name, row),
    exclusionReason: exclusionReason(name, row),
  }));
  const batchRows: BatchRow[] = Object.values(props.selection.rows)
    .filter((row) => selected.some((id) => String(id) === String(row.id)) && row.eligible)
    .map((row) => ({ id: String(row.id), number: row.number ?? String(row.id) }));
  const openDetail = (row: Row) => {
    if (!reverseLookup) return;
    navigate(`/${name}/${String(row.id)}`, { state: { listReturn: location.pathname + location.search } });
  };
  const handleEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || !selectedRows.length || isTextEntry(event.target)) return;
    event.preventDefault();
    openDetail(selectedRows[0]!);
  };
  const onRow = reverseLookup
    ? (row: Row) => ({
        onDoubleClick: (event: MouseEvent<HTMLTableRowElement>) => {
          if (!isInteractiveTarget(event.target)) openDetail(row);
        },
      })
    : undefined;
  const expansion = useMatchedExpansion(configured, reverseLookup && Boolean(state.params.productCodes));
  const layout = useColumnLayout(expansion.columns, columnPrefs);
  return (
    <div
      ref={layout.root}
      data-table-resize-root
      onKeyDown={handleEnter}
      tabIndex={-1}
      data-testid={`${name}-table-shell`}
    >
      <ResizeEnabled value={layout.canResize}>
        <ConfigProvider
          theme={{
            components: { Table: { rowSelectedBg: token.colorBgLayout, rowSelectedHoverBg: token.colorBgLayout } },
          }}
        >
          <ProTable<Row>
            rowKey="id"
            columns={layout.columns}
            components={{ header: { cell: ResizeHeader } }}
            tableLayout="fixed"
            expandable={expansion.expandable}
            dataSource={data.items}
            search={false}
            sortDirections={['ascend', 'descend', null]}
            headerTitle={
              data.matchedTotals
                ? `查询结果 · ${data.matchedTotals.documentCount} 单 · ${data.matchedTotals.lineCount} 行 · ${data.matchedTotals.packages} 包 · ${tonnes(data.matchedTotals.weightGrams)} 吨`
                : `查询结果 · ${data.total} 条`
            }
            loading={props.refreshing}
            size="middle"
            options={{
              density: false,
              fullScreen: false,
              reload: () => {
                props.reload();
              },
              setting: {
                draggable: true,
                checkedReset: false,
                extra: <ColumnReset resetWidths={columnPrefs.resetWidths} resetAll={columnPrefs.resetAll} />,
              },
            }}
            columnsState={columnPrefs.state}
            toolBarRender={() => [
              ...(selected.length > 0 && reverseLookup
                ? [
                    <BatchReverseActions
                      key="batch-reverse"
                      kind={lifecycleKind!}
                      rows={batchRows}
                      excluded={Object.values(props.selection.rows)
                        .filter((row) => !row.eligible)
                        .map((row) => ({
                          id: String(row.id),
                          number: row.number ?? '',
                          reason: row.exclusionReason ?? '',
                        }))}
                      selectedCount={selected.length}
                      onClear={() => setSelected([])}
                    />,
                  ]
                : []),
              <ListExportPanel key="export" {...props} />,
            ]}
            scroll={{ x: layout.width, y: 480 }}
            locale={{ emptyText: props.emptyText ?? '没有符合条件的记录，可调整筛选条件或重置后重试' }}
            rowSelection={{
              alwaysShowAlert: true,
              selectedRowKeys: selected,
              onChange: (keys) => setSelected(keys, currentSelectionRows),
              preserveSelectedRowKeys: true,
              columnWidth: COLUMN_WIDTH.selection,
            }}
            tableAlertRender={() => <span role="status">已选择 {selected.length} 条；变更筛选将清空选择</span>}
            tableAlertOptionRender={() => (
              <Button type="link" onClick={() => setSelected([])}>
                清空选择
              </Button>
            )}
            onRow={onRow}
            pagination={{
              current: data.page,
              pageSize: data.pageSize,
              total: data.total,
              showSizeChanger: true,
              pageSizeOptions: WEB_LIST_PAGE_SIZES.map(String),
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={(page, _filters, sorter, extra) => {
              if (extra.action === 'paginate')
                state.change({
                  page: String(page.current ?? 1),
                  pageSize: String(page.pageSize ?? WEB_LIST_PAGE_SIZES[0]),
                });
              if (extra.action === 'sort' && !Array.isArray(sorter)) {
                if (!sorter.order) {
                  state.change({ page: '1', sortBy: '', direction: '' });
                  return;
                }
                const field = Array.isArray(sorter.field) ? sorter.field[0] : sorter.field;
                if (typeof field === 'string')
                  state.change({ page: '1', sortBy: field, direction: sorter.order === 'ascend' ? 'asc' : 'desc' });
              }
            }}
          />
        </ConfigProvider>
      </ResizeEnabled>
    </div>
  );
}
