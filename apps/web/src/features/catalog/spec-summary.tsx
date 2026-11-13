import { useQuery } from '@tanstack/react-query';
import { Button, Table, type TableColumnsType } from 'antd';
import type { CatalogSpecSummaryResult } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { Card, EmptyState } from '../../components/ui';
import { catalogKeys } from './keys';
import { catalogQueryCopy, CATALOG_QUERY_DEFAULT_PAGE_SIZE, CATALOG_QUERY_PAGE_SIZE_OPTIONS } from './query-copy';
import { formatCatalogWeight } from './query-display';

type SummaryItem = CatalogSpecSummaryResult['items'][number];

export function CatalogSpecSummary() {
  const query = useQuery(catalogKeys.specSummary);
  return (
    <Card title={catalogQueryCopy.summaryTitle}>
      {query.error && (
        <RequestError
          type="error"
          error={query.error}
          action={<Button onClick={() => void query.refetch()}>{catalogQueryCopy.retrySummary}</Button>}
        />
      )}
      {query.data?.items.length === 0 ? (
        <EmptyState description={catalogQueryCopy.summaryEmpty} />
      ) : (
        <SummaryTable items={query.data?.items ?? []} loading={query.isLoading} />
      )}
    </Card>
  );
}

function SummaryTable({ items, loading }: { items: SummaryItem[]; loading: boolean }) {
  return (
    <Table<SummaryItem>
      rowKey={(row) => row.sourceSpec ?? catalogQueryCopy.noSpec}
      columns={summaryColumns()}
      dataSource={items}
      loading={loading}
      pagination={{
        pageSize: CATALOG_QUERY_DEFAULT_PAGE_SIZE,
        pageSizeOptions: [...CATALOG_QUERY_PAGE_SIZE_OPTIONS],
        showSizeChanger: true,
      }}
    />
  );
}

function summaryColumns(): TableColumnsType<SummaryItem> {
  return [
    {
      title: catalogQueryCopy.spec,
      dataIndex: 'sourceSpec',
      render: (spec: string | null) => spec ?? catalogQueryCopy.noSpec,
    },
    { title: catalogQueryCopy.barcodeCount, dataIndex: 'barcodeCount', align: 'right' },
    {
      title: catalogQueryCopy.totalWeight,
      dataIndex: 'totalWeightGrams',
      align: 'right',
      render: formatCatalogWeight,
    },
    { title: catalogQueryCopy.minWeight, dataIndex: 'minWeightGrams', align: 'right', render: formatCatalogWeight },
    { title: catalogQueryCopy.maxWeight, dataIndex: 'maxWeightGrams', align: 'right', render: formatCatalogWeight },
    {
      title: catalogQueryCopy.averageWeight,
      dataIndex: 'averageWeightGrams',
      align: 'right',
      render: formatCatalogWeight,
    },
  ];
}
