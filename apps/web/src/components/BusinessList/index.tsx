import type { ExportKind } from '@wms/contracts';
import type { Key, ReactNode } from 'react';
import { PageContainer, type ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Result, Skeleton, theme } from 'antd';
import { ZodError } from 'zod';
import { ApiError } from '../../api/client';
import { ListTable, type ListData } from './table';
import type { ListState } from './use-list-state';
import { useListSelection } from './use-list-selection';
import './style.css';

interface Props<Row> {
  config: { name: ExportKind; title: string; description: string; extra?: ReactNode; columns: ProColumns<Row>[] };
  state: ListState;
  query: { data?: ListData<Row>; error: Error | null; isPending: boolean; isFetching: boolean; refetch: () => unknown };
  filters: ReactNode;
  children?: ReactNode;
  summary?: ReactNode;
}
function ListError({ error, reload }: { error: Error; reload: () => unknown }) {
  if (error instanceof ApiError && error.status === 403) return <Result status="403" title="无权查看此列表" />;
  return (
    <Alert
      type="error"
      showIcon
      title="列表加载失败，已停止展示旧数据"
      description={error instanceof ZodError ? '返回数据未通过契约校验，未展示记录或小计。请重试。' : error.message}
      action={
        <Button
          aria-label="重试"
          onClick={() => {
            reload();
          }}
        >
          重试
        </Button>
      }
    />
  );
}
export function BusinessList<Row extends { id: Key }>(props: Props<Row>) {
  const { config, query, state } = props;
  const { token } = theme.useToken();
  const { page: _page, pageSize: _size, sortBy: _sort, direction: _dir, ...scope } = state.params;
  const selection = useListSelection(JSON.stringify(scope), query.data?.rowTokens);
  return (
    <PageContainer
      title={<h1 style={{ fontSize: token.fontSizeHeading3, margin: 0 }}>{config.title}</h1>}
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
        {props.filters}
      </div>
      {query.error ? (
        <ListError error={query.error} reload={query.refetch} />
      ) : query.isPending || !query.data ? (
        <div role="status" aria-label="正在查询列表">
          <Skeleton active />
        </div>
      ) : (
        <div data-testid="list-results" className="business-list-results">
          <section data-testid={config.name + '-list'}>
            {props.summary}
            <ListTable
              key={JSON.stringify(scope)}
              name={config.name}
              columns={config.columns}
              data={query.data}
              state={state}
              refreshing={query.isFetching}
              reload={query.refetch}
              selection={selection}
            />
          </section>
          {props.children}
        </div>
      )}
    </PageContainer>
  );
}
