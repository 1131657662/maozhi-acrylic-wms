import { WEB_LIST_DEFAULT_PAGE_SIZE } from '@wms/contracts';
import type { Key, ReactNode } from 'react';
import { theme } from 'antd';
import { ListExportPanel } from './list-export';
import { BusinessListFilterContent } from './filter-content';
import { BusinessListFrame } from './frame';
import type { BusinessListConfig } from './config';
import { BusinessListResults } from './results-content';
import type { ListData } from './table';
import type { ListState } from './use-list-state';
import { useListSelection } from './use-list-selection';
import { useListColumns } from './use-list-columns';
import { useListViews } from './use-list-views';
import type { ListTableSummary } from './table-summary';
import type { TableProps } from 'antd';
import { useSession } from '../../features/auth/use-session';
import './style.css';

interface Props<Row> {
  config: BusinessListConfig<Row>;
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
  tableSummary?: ListTableSummary<Row>;
  expandable?: TableProps<Row>['expandable'];
  beforeResults?: ReactNode;
  resultView?: ReactNode;
}

function listScopeKey(state: ListState): string {
  const { page: _page, pageSize: _size, sortBy: _sort, direction: _direction, ...scope } = state.params;
  return JSON.stringify(Object.fromEntries(Object.entries(scope).sort(([a], [b]) => a.localeCompare(b))));
}

export function BusinessList<Row extends { id: Key }>(props: Props<Row>) {
  const { config, state, query } = props,
    { data: session } = useSession(),
    { token } = theme.useToken(),
    identity = session?.username ?? 'anonymous',
    scopeKey = listScopeKey(state),
    selection = useListSelection(scopeKey, query.data?.rowTokens),
    columns = useListColumns(config.name, config.columns, identity),
    views = useListViews({ kind: config.name, identity, state, columns: columns.value, applyColumns: columns.apply }),
    exportAction = config.exportInHeader ? (
      <ListExportPanel
        name={config.name}
        state={state}
        data={query.data ?? { items: [], total: 0, page: 1, pageSize: WEB_LIST_DEFAULT_PAGE_SIZE }}
        refreshing={query.isFetching || Boolean(query.error)}
        placeholder={query.isPlaceholderData ?? false}
        reload={query.refetch}
        selection={selection}
        columnPrefs={columns}
        onOpen={config.onExportOpen}
      />
    ) : (
      config.extra
    );

  return (
    <BusinessListFrame
      config={config}
      token={token}
      exportAction={exportAction}
      beforeResults={props.beforeResults}
      filters={
        <BusinessListFilterContent
          identity={identity}
          scopeKey={scopeKey}
          design={config.designShell && config.designViewToolbar}
          views={views.views}
          apply={views.apply}
          save={views.save}
          remove={views.remove}
        >
          {props.filters}
        </BusinessListFilterContent>
      }
      results={
        <BusinessListResults
          name={config.name}
          exportInHeader={config.exportInHeader}
          resultCardTitle={config.resultCardTitle}
          skeleton={config.skeleton}
          emptyText={config.emptyText}
          query={query}
          state={state}
          selection={selection}
          columns={columns}
          summary={props.summary}
          tableSummary={props.tableSummary}
          expandable={props.expandable}
          resultView={props.resultView}
        >
          {props.children}
        </BusinessListResults>
      }
    />
  );
}
