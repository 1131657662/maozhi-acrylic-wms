import { Link, useLocation, useSearchParams } from '@umijs/max';
import { HistoryOutlined } from '@ant-design/icons';
import { Alert, Card, Space } from 'antd';
import { STOCK_MOVEMENT_PAGE_SIZE, WEB_LIST_PAGE_SIZES } from '@wms/contracts';
import { PageShell, SectionTitle } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { MovementFilter } from './movement-filter';
import { MovementTable } from './movement-table';
import { movementCopy as copy } from './movement-copy';
import { useStockMovements } from './use-stock-movements';
import { movementUrl, parseMovementParams } from './movement-url';

export function StockMovementPage() {
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const parsed = parseMovementParams(search);
  const stateEntryId =
    typeof location.state === 'object' &&
    location.state !== null &&
    'entryId' in location.state &&
    typeof location.state.entryId === 'string'
      ? location.state.entryId
      : undefined;
  const returnTo =
    typeof location.state === 'object' &&
    location.state !== null &&
    'returnTo' in location.state &&
    typeof location.state.returnTo === 'string' &&
    location.state.returnTo.startsWith('/stock?')
      ? location.state.returnTo
      : undefined;
  const query = useStockMovements(parsed.success ? parsed.data : undefined);
  const updateFilters = (warehouse: string, product: string) =>
    setSearch(
      movementUrl({
        ...(warehouse.trim() ? { warehouseCode: warehouse.trim() } : {}),
        ...(product.trim() ? { productCode: product.trim() } : {}),
        page: '1',
        pageSize: parsed.data?.pageSize ?? STOCK_MOVEMENT_PAGE_SIZE,
      }),
      { state: location.state },
    );
  const changePage = (page: number, pageSize: number) =>
    setSearch(
      movementUrl({
        ...(parsed.data?.warehouseCode ? { warehouseCode: parsed.data.warehouseCode } : {}),
        ...(parsed.data?.productCode ? { productCode: parsed.data.productCode } : {}),
        page,
        pageSize,
      }),
      { state: location.state },
    );
  return (
    <PageShell title={copy.title} icon={<HistoryOutlined />} description={copy.description}>
      <Card
        title={<SectionTitle title={copy.title} />}
        extra={<Link to={returnTo ?? '/stock'}>{copy.returnToStock}</Link>}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <MovementFilter
            key={search.toString()}
            initialWarehouse={parsed.data?.warehouseCode ?? ''}
            initialProduct={parsed.data?.productCode ?? ''}
            submit={updateFilters}
            reset={() => updateFilters('', '')}
          />
          {!parsed.success ? (
            <Alert type="error" showIcon title={copy.queryInvalid} />
          ) : query.error ? (
            <RequestError error={query.error} retry={query.refetch} />
          ) : (
            <MovementTable
              rows={query.data?.items ?? []}
              loading={query.isPending || query.isFetching}
              targetId={stateEntryId}
              pagination={{
                current: parsed.data.page,
                pageSize: parsed.data.pageSize,
                total: query.data?.total ?? 0,
                showSizeChanger: true,
                pageSizeOptions: [...WEB_LIST_PAGE_SIZES],
                showTotal: copy.total,
                onChange: changePage,
              }}
            />
          )}
        </Space>
      </Card>
    </PageShell>
  );
}
