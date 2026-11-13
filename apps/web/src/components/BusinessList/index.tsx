import { WEB_LIST_DEFAULT_PAGE_SIZE, type ExportKind } from '@wms/contracts';
import type { Key, ReactNode } from 'react';
import { PageContainer, type ProColumns } from '@ant-design/pro-components';
import { Spin, Skeleton, theme } from 'antd';
import { ListExportPanel } from './list-export';
import { RequestError } from '../RequestError';

import { useSession } from '../../features/auth/use-session';
import type { ListData } from './table';
import { ListResults } from './results';
import { ListViewToolbar } from './list-view-toolbar';
import { useListColumns } from './use-list-columns';
import type { ListState } from './use-list-state';
import { useListSelection } from './use-list-selection';
import { useListViews } from './use-list-views';
import './style.css';
import { listFeedback } from './list-feedback';
import { Card, PageShell } from '../ui';
import { spacing } from '../../theme/design-tokens';

interface Config<Row> {
  name: ExportKind;
  title: string;
  icon?: ReactNode;
  description: string;
  extra?: ReactNode;
  columns: ProColumns<Row>[];
  emptyText?: ReactNode;
  exportInHeader?: boolean;
  onExportOpen?: () => void;
  skeleton?: boolean;
  designShell?: boolean;
  designViewToolbar?: boolean;
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
  beforeResults?: ReactNode;
  resultView?: ReactNode;
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
  const exportAction = config.exportInHeader ? (
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
  const filterContent = (
    <>
      {session?.username && (
        <div className="business-list-view-toolbar" style={{ marginBottom: token.marginSM }}>
          <ListViewToolbar
            design={config.designShell && config.designViewToolbar}
            key={scopeKey}
            views={views.views}
            apply={views.apply}
            save={views.save}
            remove={views.remove}
          />
        </div>
      )}
      {props.filters}
    </>
  );
  const filter = config.designShell ? (
    <Card padding="large" testId="list-filters">
      {filterContent}
    </Card>
  ) : (
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
      {filterContent}
    </div>
  );
  const content = (
    <>
      {filter}
      {props.beforeResults}
      {query.error ? (
        <ListError error={query.error} reload={query.refetch} />
      ) : query.isPending || !query.data ? (
        <div role="status" aria-label={listFeedback.loading}>
          {config.skeleton ? <Skeleton active /> : <Spin size="small" />}
        </div>
      ) : (
        <div data-testid="list-results" className="business-list-results">
          {props.resultView ?? (
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
          )}
          {props.children}
        </div>
      )}
    </>
  );
  if (config.designShell) {
    return (
      <PageShell title={config.title} icon={config.icon} description={config.description} actions={exportAction}>
        <div className="business-list" style={{ display: 'grid', gap: spacing[16] }}>
          {content}
        </div>
      </PageShell>
    );
  }
  return (
    <PageContainer
      title={
        <h1 style={{ fontSize: token.fontSizeHeading4, margin: 0 }}>
          {config.icon && (
            <span style={{ fontSize: token.fontSizeLG, marginInlineEnd: token.marginXS }}>{config.icon}</span>
          )}
          {config.title}
        </h1>
      }
      content={config.description}
      extra={exportAction}
      className="business-list"
      token={{ paddingInlinePageContainerContent: token.paddingLG }}
      style={{ minWidth: 0, maxWidth: '100%' }}
    >
      {content}
    </PageContainer>
  );
}
