import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Empty, Table, type TableColumnsType } from 'antd';
import type { CatalogBarcodeTraceResult } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { EmptyState, StatusTag } from '../../components/ui';
import { catalogKeys } from './keys';
import { catalogQueryCopy, CATALOG_TRACE_DRAWER_SIZE } from './query-copy';
import { catalogStatusPresentation, formatCatalogWeight } from './query-display';

type TraceVersion = CatalogBarcodeTraceResult['versions'][number];

export function BarcodeTraceDrawer({ barcode, onClose }: { barcode: string | null; onClose: () => void }) {
  const query = useQuery({ ...catalogKeys.trace(barcode ?? ''), enabled: Boolean(barcode) });
  return (
    <Drawer
      title={`${catalogQueryCopy.traceTitle} · ${barcode ?? ''}`}
      open={Boolean(barcode)}
      onClose={onClose}
      size={CATALOG_TRACE_DRAWER_SIZE}
      destroyOnHidden
    >
      {query.error && (
        <RequestError
          type="error"
          error={query.error}
          action={<Button onClick={() => void query.refetch()}>{catalogQueryCopy.retryTrace}</Button>}
        />
      )}
      {query.data && <TraceContent trace={query.data} loading={query.isLoading} />}
    </Drawer>
  );
}

function TraceContent({ trace, loading }: { trace: CatalogBarcodeTraceResult; loading: boolean }) {
  if (!trace.versions.length) return <EmptyState description={catalogQueryCopy.traceEmpty} />;
  return (
    <>
      <TraceRange first={trace.firstVersionId!} last={trace.lastVersionId!} />
      <Table<TraceVersion>
        rowKey="versionId"
        columns={traceColumns()}
        dataSource={trace.versions}
        loading={loading}
        pagination={false}
        locale={{ emptyText: <Empty description={catalogQueryCopy.traceEmpty} /> }}
      />
    </>
  );
}

function TraceRange({ first, last }: { first: number; last: number }) {
  return (
    <div>
      <StatusTag status={`${catalogQueryCopy.firstVersion} · 第 ${first} 版`} type="processing" />
      <StatusTag status={`${catalogQueryCopy.lastVersion} · 第 ${last} 版`} type="processing" />
    </div>
  );
}

function traceColumns(): TableColumnsType<TraceVersion> {
  return [
    { title: catalogQueryCopy.version, dataIndex: 'versionId', render: (versionId: number) => `第 ${versionId} 版` },
    {
      title: catalogQueryCopy.status,
      dataIndex: 'status',
      render: (status: TraceVersion['status']) => {
        const view = catalogStatusPresentation(status);
        return <StatusTag status={view.label} type={view.tone} />;
      },
    },
    {
      title: catalogQueryCopy.spec,
      dataIndex: 'sourceSpec',
      render: (spec: string | null) => spec ?? catalogQueryCopy.noSpec,
    },
    { title: catalogQueryCopy.weight, dataIndex: 'weightGrams', align: 'right', render: formatCatalogWeight },
  ];
}
