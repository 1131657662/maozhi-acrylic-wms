import type { ExportKind } from '@wms/contracts';
import type { Key, ReactNode } from 'react';
import { PageContainer, type ProColumns } from '@ant-design/pro-components';
import { Spin, theme } from 'antd';
import { RequestError } from '../RequestError';

import { useSession } from '../../features/auth/use-session';
import { ListTable, type ListData } from './table';
import { ListViewToolbar } from './list-view-toolbar';
import { useListColumns, type ListColumnPreferences } from './use-list-columns';
import type { ListState } from './use-list-state';
import { useListSelection, type ListSelectionRow, type SelectionKeys } from './use-list-selection';
import { useListViews } from './use-list-views';
import './style.css';
import { listFeedback } from './list-feedback';

interface Config<Row> {
  name: ExportKind;
  title: string;
  description: string;
  extra?: ReactNode;
  columns: ProColumns<Row>[];
  emptyText?: ReactNode;
}
interface Props<Row> {
  config: Config<Row>;
  state: ListState;
  query: {
    data?: ListData<Row>;
    error: Error | null;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData?: boolean;
    refetch: () => unknown;
  };
  filters: ReactNode;
  children?: ReactNode;
  summary?: ReactNode;
}
interface ResultsProps<Row extends { id: Key }> {
  config: Config<Row>;
  data: ListData<Row>;
  state: ListState;
  selection: {
    tokens: Record<string, string>;
    keys: Key[];
    rows: Record<string, ListSelectionRow>;
    change: (keys: SelectionKeys, rows?: ListSelectionRow[]) => void;
  };
  columnPrefs: ListColumnPreferences<Row>;
  refreshing: boolean;
  placeholder: boolean;
  reload: () => unknown;
  summary?: ReactNode;
  emptyText?: ReactNode;
}
function ListResults<Row extends { id: Key }>({
  config,
  data,
  state,
  selection,
  columnPrefs,
  refreshing,
  placeholder,
  reload,
  summary,
  emptyText,
}: ResultsProps<Row>) {
  return (
    <section data-testid={config.name + '-list'}>
      {summary}
      <ListTable
        name={config.name}
        data={data}
        state={state}
        refreshing={refreshing}
        placeholder={placeholder}
        reload={reload}
        selection={selection}
        columnPrefs={columnPrefs}
        emptyText={emptyText}
      />
    </section>
  );
}
function ListError({ error, reload }: { error: Error; reload: () => unknown }) {
  return <RequestError error={error} retry={reload} />;
}
export function BusinessList<Row extends { id: Key }>(props: Props<Row>) {
  const { config, query, state } = props;
  const { data: session } = useSession();
  const identity = session?.username ?? 'anonymous';
  const { token } = theme.useToken();
  const { page: _page, pageSize: _size, sortBy: _sort, direction: _dir, ...scope } = state.params;
  const scopeKey = JSON.stringify(Object.fromEntries(Object.entries(scope).sort(([a], [b]) => a.localeCompare(b))));
  const selection = useListSelection(scopeKey, query.data?.rowTokens);
  const columns = useListColumns(config.name, config.columns, identity);
  const views = useListViews({
    kind: config.name,
    identity,
    state,
    columns: columns.value,
    applyColumns: columns.apply,
  });
  return (
    <PageContainer
      title={<h1 style={{ fontSize: token.fontSizeHeading4, margin: 0 }}>{config.title}</h1>}
      content={config.description}
      extra={config.extra}
      className="business-list"
      token={{ paddingInlinePageContainerContent: token.paddingLG }}
      style={{ minWidth: 0, maxWidth: '100%' }}
    >
      <div
        className="business-list-filter"
        style={{
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          padding: token.padding,
          marginBottom: token.margin,
        }}
        data-testid="list-filters"
      >
        {session?.username && (
          <div className="business-list-view-toolbar" style={{ marginBottom: token.marginSM }}>
            <ListViewToolbar
              key={scopeKey}
              views={views.views}
              apply={views.apply}
              save={views.save}
              remove={views.remove}
            />
          </div>
        )}
        {props.filters}
      </div>
      {query.error ? (
        <ListError error={query.error} reload={query.refetch} />
      ) : query.isPending || !query.data ? (
        <div role="status" aria-label={listFeedback.loading}>
          <Spin size="small" />
        </div>
      ) : (
        <div data-testid="list-results" className="business-list-results">
          <ListResults
            config={config}
            data={query.data}
            state={state}
            selection={selection}
            columnPrefs={columns}
            refreshing={query.isFetching}
            placeholder={query.isPlaceholderData ?? false}
            reload={query.refetch}
            summary={props.summary}
            emptyText={config.emptyText}
          />
          {props.children}
        </div>
      )}
    </PageContainer>
  );
}
