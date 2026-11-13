import { Button, Input, Space, Table, Tooltip, type TableColumnsType } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { CatalogSearchQuery, CatalogSearchResult } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { StatusTag } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
import { catalogQueryCopy, CATALOG_QUERY_MAX_LENGTH, CATALOG_QUERY_PAGE_SIZE_OPTIONS } from './query-copy';
import { formatCatalogWeight } from './query-display';

type SearchItem = CatalogSearchResult['items'][number];

interface SearchTableProps {
  query: CatalogSearchQuery;
  result?: CatalogSearchResult;
  loading: boolean;
  error: unknown;
  onSearch: (query: string) => void;
  onPage: (page: number, pageSize: number) => void;
  onTrace: (barcode: string) => void;
  onRetry: () => void;
}

export function DirectorySearchTable(props: SearchTableProps) {
  return (
    <Space orientation="vertical" size={spacing[16]} style={{ width: '100%' }}>
      <SearchToolbar {...props} />
      {Boolean(props.error) && (
        <RequestError
          type="error"
          error={props.error}
          action={<Button onClick={props.onRetry}>{catalogQueryCopy.retrySearch}</Button>}
        />
      )}
      <Table<SearchItem>
        rowKey="barcode"
        columns={searchColumns(props.onTrace)}
        dataSource={props.error ? [] : props.result?.items}
        loading={props.loading}
        locale={{ emptyText: catalogQueryCopy.searchEmpty }}
        pagination={{
          current: props.query.page,
          pageSize: props.query.pageSize,
          pageSizeOptions: [...CATALOG_QUERY_PAGE_SIZE_OPTIONS],
          showSizeChanger: true,
          showTotal: catalogQueryCopy.total,
          total: props.result?.total ?? 0,
          onChange: props.onPage,
        }}
      />
    </Space>
  );
}

function SearchToolbar({ query, result, loading, onSearch }: SearchTableProps) {
  return (
    <Space wrap size={spacing[8]} style={{ width: '100%' }}>
      <Input.Search
        aria-label={catalogQueryCopy.searchLabel}
        placeholder={catalogQueryCopy.searchPlaceholder}
        maxLength={CATALOG_QUERY_MAX_LENGTH}
        allowClear
        autoFocus
        loading={loading}
        defaultValue={query.q}
        onSearch={onSearch}
        style={{ width: 'min(480px, 100%)' }}
      />
      {result?.version && (
        <StatusTag status={catalogQueryCopy.currentVersion(result.version.versionId)} type="processing" />
      )}
    </Space>
  );
}

function searchColumns(onTrace: (barcode: string) => void): TableColumnsType<SearchItem> {
  return [
    {
      title: catalogQueryCopy.barcode,
      dataIndex: 'barcode',
      render: (_: string, row) => (
        <Space size={spacing[4]}>
          <span>{row.barcode}</span>
          <Tooltip title={catalogQueryCopy.traceAction}>
            <Button
              aria-label={`${catalogQueryCopy.traceAction} ${row.barcode}`}
              icon={<HistoryOutlined />}
              onClick={() => onTrace(row.barcode)}
              type="text"
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: catalogQueryCopy.spec,
      dataIndex: 'sourceSpec',
      render: (spec: string | null) => spec ?? catalogQueryCopy.noSpec,
    },
    { title: catalogQueryCopy.weight, dataIndex: 'weightGrams', render: formatCatalogWeight, align: 'right' },
  ];
}
