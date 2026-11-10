import { WEB_LIST_PAGE_SIZES, tonnes, type ExportKind, type WebMatchedTotals } from '@wms/contracts';
import type { ListColumnPreferences } from './use-list-columns';
import { ExportPanel } from '../../features/web-exports/panel';
import { useMemo, type Key, type ReactNode, type KeyboardEvent, type MouseEvent } from 'react';
import { Button } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import type { ListState } from './use-list-state';
import { MatchedLines } from './matched-lines';
import type { WebMatchedLine } from '@wms/contracts';
import { useLocation, useNavigate } from '@umijs/max';
import { BatchReverseActions, type BatchRow } from './batch-actions';
import type { ListSelectionRow } from './use-list-selection';
import { documentNumber, isEligible, isInteractiveTarget, isTextEntry } from './table-helpers';

export interface ListData<Row> {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  viewToken?: string;
  rowTokens?: Record<string, string>;
  matchedTotals?: WebMatchedTotals;
}
interface Props<Row> {
  data: ListData<Row>;
  state: ListState;
  name: ExportKind;
  refreshing: boolean;
  reload: () => unknown;
  selection: {
    tokens: Record<string, string>;
    keys: Key[];
    rows: Record<string, ListSelectionRow>;
    change: (keys: Key[], rows?: ListSelectionRow[]) => void;
  };
  columnPrefs: ListColumnPreferences<Row>;
  emptyText?: ReactNode;
}
export function ListTable<Row extends { id: Key }>(props: Props<Row>) {
  const { keys: selected, change: setSelected } = props.selection;
  const { data, state, name, columnPrefs } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const configured = useMemo(
    () =>
      columnPrefs.configured
        .filter((column) => column.dataIndex !== 'matchedSummary' || Boolean(state.params.productCodes))
        .map((column) => ({
          ...column,
          sortOrder:
            column.dataIndex === state.params.sortBy
              ? ((state.params.direction === 'asc' ? 'ascend' : 'descend') as 'ascend' | 'descend')
              : null,
        })),
    [columnPrefs.configured, state.params.productCodes, state.params.sortBy, state.params.direction],
  );
  const reverseLookup = name === 'inbound' || name === 'outbound';
  const lifecycleKind = reverseLookup ? name : null;
  const selectedRows = data.items.filter((row) => selected.includes(row.id));
  const currentSelectionRows: ListSelectionRow[] = data.items.map((row) => ({
    id: row.id,
    number: documentNumber(name, row),
    eligible: isEligible(name, row),
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
  const expandable =
    reverseLookup && state.params.productCodes
      ? {
          rowExpandable: (row: Row & { matchedLineCount?: number }) => (row.matchedLineCount ?? 0) > 0,
          expandedRowRender: (row: Row & { matchedLines?: WebMatchedLine[] }) => (
            <MatchedLines lines={row.matchedLines ?? []} />
          ),
        }
      : undefined;
  return (
    <div onKeyDown={handleEnter} tabIndex={-1} data-testid={`${name}-table-shell`}>
      <ProTable<Row>
        rowKey="id"
        columns={configured}
        expandable={expandable}
        dataSource={data.items}
        search={false}
        sortDirections={['ascend', 'descend', 'ascend']}
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
          setting: { draggable: true },
        }}
        columnsState={columnPrefs.state}
        toolBarRender={() => [
          selected.length > 0 && reverseLookup ? (
            <BatchReverseActions
              key="batch-reverse"
              kind={lifecycleKind!}
              rows={batchRows}
              selectedCount={selected.length}
              onClear={() => setSelected([])}
            />
          ) : (
            <div className="business-list-toolbar-slot" key="export">
              <ExportPanel
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
              />
            </div>
          ),
        ]}
        scroll={{ x: 'max-content', y: 480 }}
        locale={{ emptyText: props.emptyText ?? '没有符合条件的记录，可调整筛选条件或重置后重试' }}
        rowSelection={{
          alwaysShowAlert: true,
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys, currentSelectionRows),
          preserveSelectedRowKeys: true,
          columnWidth: 48,
          getCheckboxProps: (row) => ({ disabled: !isEligible(name, row) }),
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
            const field = Array.isArray(sorter.field) ? sorter.field[0] : sorter.field;
            if (typeof field === 'string')
              state.change({ page: '1', sortBy: field, direction: sorter.order === 'ascend' ? 'asc' : 'desc' });
          }
        }}
      />
    </div>
  );
}
