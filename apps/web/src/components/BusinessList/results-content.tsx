import type { Key, ReactNode } from 'react';
import type { ExportKind } from '@wms/contracts';
import { Spin, Skeleton } from 'antd';
import { RequestError } from '../RequestError';
import { ListResults } from './results';
import type { ListData } from './table';
import type { ListColumnPreferences } from './use-list-columns';
import type { ListState } from './use-list-state';
import type { ListTableSummary } from './table-summary';
import type { TableProps } from 'antd';
import type { useListSelection } from './use-list-selection';
import { listFeedback } from './list-feedback';

interface Props<Row extends { id: Key }> {
  name: ExportKind;
  exportInHeader?: boolean;
  resultCardTitle?: ReactNode;
  skeleton?: boolean;
  emptyText?: ReactNode;
  query: {
    data?: ListData<Row>;
    error: Error | null;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData?: boolean;
    refetch: () => unknown;
  };
  state: ListState;
  selection: ReturnType<typeof useListSelection>;
  columns: ListColumnPreferences<Row>;
  summary?: ReactNode;
  tableSummary?: ListTableSummary<Row>;
  expandable?: TableProps<Row>['expandable'];
  children?: ReactNode;
  resultView?: ReactNode;
}

export function BusinessListResults<Row extends { id: Key }>(props: Props<Row>) {
  const { query } = props;
  if (query.error) return <RequestError error={query.error} retry={query.refetch} />;
  if (query.isPending || !query.data)
    return (
      <div role="status" aria-label={listFeedback.loading}>
        {props.skeleton ? <Skeleton active /> : <Spin size="small" />}
      </div>
    );

  return (
    <div data-testid="list-results" className="business-list-results">
      {props.resultView ?? (
        <ListResults
          config={{ name: props.name, exportInHeader: props.exportInHeader, resultCardTitle: props.resultCardTitle }}
          data={query.data}
          state={props.state}
          selection={props.selection}
          columnPrefs={props.columns}
          refreshing={query.isFetching}
          placeholder={query.isPlaceholderData ?? false}
          reload={query.refetch}
          summary={props.summary}
          tableSummary={props.tableSummary}
          expandable={props.expandable}
          emptyText={props.emptyText}
        />
      )}
      {props.children}
    </div>
  );
}
