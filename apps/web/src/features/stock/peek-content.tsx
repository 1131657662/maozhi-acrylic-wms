import { Link } from '@umijs/max';
import { Button, Spin, Table, Space } from 'antd';
import { tonnes, type StockPeekRow } from '@wms/contracts';
import { EmptyState } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { JournalTypeTag } from '../../components/JournalTypeTag';
import { formatTime } from '../../lib/format-time';
import { movementCopy as copy } from './movement-copy';

export function PeekContent(props: {
  rows?: StockPeekRow[];
  error: Error | null;
  retry: () => unknown;
  open: () => void;
}) {
  return (
    <Space orientation="vertical" style={{ width: '100%' }} data-testid="stock-peek">
      {props.error ? (
        <RequestError error={props.error} retry={props.retry} />
      ) : !props.rows ? (
        <Spin aria-label={copy.loading} />
      ) : (
        <Table<StockPeekRow>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={props.rows}
          locale={{ emptyText: <EmptyState description={copy.empty} /> }}
          columns={[
            { title: copy.time, render: (_, row) => formatTime(row.createdAt) },
            { title: copy.type, render: (_, row) => <JournalTypeTag type={row.type} /> },
            { title: copy.packages, dataIndex: 'packagesDelta', align: 'right' },
            { title: copy.weight, render: (_, row) => tonnes(row.weightDeltaGrams), align: 'right' },
            {
              title: copy.evidence,
              render: (_, row) => (
                <Link to={row.evidence.href} state={{ entryId: row.id }}>
                  {copy.evidenceLink}
                </Link>
              ),
            },
          ]}
        />
      )}
      <Button type="link" onClick={props.open}>
        {copy.open}
      </Button>
    </Space>
  );
}
