import { WEB_LIST_PAGE_SIZES, tonnes } from '@wms/contracts';
import type { ListTableProps } from './table-types';
export type { ListData } from './table-types';
import { ListExportPanel } from './list-export';
import { ColumnReset } from './column-reset';
import { useColumnLayout } from './use-column-layout';
import { ResizeEnabled, ResizeHeader } from './resize-header';
import { useMatchedExpansion } from './use-matched-expansion';
import { COLUMN_WIDTH } from './column-settings';
import { useMemo, type Key, type KeyboardEvent } from 'react';
import { Button, ConfigProvider, Spin, theme } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import { useLocation, useNavigate } from '@umijs/max';
import { BatchReverseActions, type BatchRow } from './batch-actions';
import type { ListSelectionRow } from './use-list-selection';
import { documentNumber, isEligible, exclusionReason, isTextEntry } from './table-helpers';
import { useRowInteractions } from './use-row-interactions';
import { tableChange } from './table-change';
import { listFeedback } from './list-feedback';

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
  const onRow = useRowInteractions({
    scope: JSON.stringify(state.params),
    selection: {
      ...props.selection,
      change: (keys, rows) => {
        if (!props.placeholder) setSelected(keys, rows);
      },
    },
    rows: currentSelectionRows,
    open: openDetail,
  });
  const expansion = useMatchedExpansion(configured, reverseLookup && Boolean(state.params.productCodes));
  const layout = useColumnLayout(expansion.columns, columnPrefs, state);
  return (
    <div
      ref={layout.root}
      data-table-resize-root
      aria-busy={props.refreshing}
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
            loading={false}
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
              <span
                key="refresh"
                className="business-list-toolbar-slot"
                style={{ width: token.controlHeightSM }}
                role={props.refreshing ? 'status' : undefined}
                aria-label={props.refreshing ? listFeedback.refreshing : undefined}
              >
                <Spin size="small" spinning={props.refreshing} />
              </span>,
              ...(selected.length > 0 && reverseLookup
                ? [
                    <BatchReverseActions
                      key="batch-reverse"
                      kind={lifecycleKind!}
                      refreshing={props.refreshing}
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
            scroll={{ x: layout.width, y: 480, scrollToFirstRowOnChange: false }}
            locale={{ emptyText: props.emptyText ?? '没有符合条件的记录，可调整筛选条件或重置后重试' }}
            rowSelection={{
              alwaysShowAlert: true,
              selectedRowKeys: selected,
              onChange: (keys) => {
                if (!props.placeholder) setSelected(keys, currentSelectionRows);
              },
              getCheckboxProps: () => ({ disabled: props.placeholder }),
              preserveSelectedRowKeys: true,
              columnWidth: COLUMN_WIDTH.selection,
              renderCell: (_checked, _row, _index, node) => (
                <span onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                  {node}
                </span>
              ),
            }}
            tableAlertRender={() => <span role="status">已选择 {selected.length} 条；变更筛选将清空选择</span>}
            tableAlertOptionRender={() => (
              <Button type="link" onClick={() => setSelected([])}>
                清空选择
              </Button>
            )}
            onRow={onRow}
            pagination={{
              current: Number(state.params.page),
              pageSize: Number(state.params.pageSize),
              total: data.total,
              showSizeChanger: true,
              pageSizeOptions: WEB_LIST_PAGE_SIZES.map(String),
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={tableChange<Row>(state, layout.root)}
          />
        </ConfigProvider>
      </ResizeEnabled>
    </div>
  );
}
