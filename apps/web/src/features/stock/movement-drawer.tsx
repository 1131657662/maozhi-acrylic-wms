import { Drawer, Descriptions, Button, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@umijs/max';
import { tonnes, STOCK_MOVEMENT_PAGE_SIZE, type WebStockRow } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { movementKeys } from './movement-keys';
import { MovementTable } from './movement-table';
import { movementCopy as copy } from './movement-copy';

export function MovementDrawer(props: {
  row: WebStockRow;
  scope: string;
  returnTo: string;
  open: boolean;
  close: () => void;
}) {
  const { row } = props;
  const query = useQuery({
    ...movementKeys.page(
      { warehouseCode: row.warehouseCode, productCode: row.productCode, page: 1, pageSize: STOCK_MOVEMENT_PAGE_SIZE },
      props.scope,
    ),
    enabled: props.open,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const url = `/stock/journal?${new URLSearchParams({ warehouseCode: row.warehouseCode, productCode: row.productCode })}`;
  return (
    <Drawer
      title={`${copy.title} · ${row.productName ?? row.productCode}`}
      open={props.open}
      onClose={props.close}
      size="large"
      footer={
        <Link to={url} state={{ returnTo: props.returnTo }}>
          <Button>{copy.all}</Button>
        </Link>
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Descriptions
          column={1}
          items={[
            { key: 'warehouse', label: copy.warehouse, children: row.warehouseName ?? row.warehouseCode },
            ...(['onHand', 'pending', 'available'] as const).map((key) => ({
              key,
              label: key === 'onHand' ? copy.current : copy[key],
              children: `${row[key].packages} 包 / ${tonnes(row[key].weightGrams)} 吨`,
            })),
          ]}
        />
        {query.error ? (
          <RequestError error={query.error} retry={query.refetch} />
        ) : (
          <MovementTable rows={query.data?.items ?? []} loading={query.isPending} pagination={false} compact />
        )}
      </Space>
    </Drawer>
  );
}
