import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Button } from 'antd';
import { tonnes, type Detail } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';
import { RequestError } from '../../components/RequestError';
import { useScanExport } from './use-scan-export';
import { actualText as text, SCAN_PAGE_SIZE, SCAN_TABLE_WIDTH } from './actual-text';
type Fact = Detail['facts'][number];
const columns: ProColumns<Fact>[] = [
  { title: text.barcode, dataIndex: 'barcode', width: 200 },
  { title: text.product, dataIndex: 'productName', width: 220, render: (_, row) => row.productName ?? text.unknown },
  { title: text.scanWeight, width: 160, render: (_, row) => tonnes(row.weightGrams) },
  { title: text.scanTime, width: 270, render: (_, row) => formatTime(row.scannedAt) },
];
export function Facts({ order }: { order: Detail }) {
  const { mutate: download, isPending: downloading, error: downloadError } = useScanExport(order.id, order.orderNo);
  return (
    <div>
      {downloadError && <RequestError error={downloadError} />}
      <ProTable<Fact>
        headerTitle={text.scanTitle}
        rowKey="id"
        columns={columns}
        dataSource={order.facts}
        search={false}
        options={false}
        pagination={{ pageSize: SCAN_PAGE_SIZE }}
        scroll={{ x: SCAN_TABLE_WIDTH }}
        toolBarRender={() => [
          <Button key="export" onClick={() => download()} loading={downloading} disabled={downloading}>
            {text.export}
          </Button>,
        ]}
        footer={() =>
          `${text.scanTotal}：${order.facts.length} 包 / ${tonnes(order.facts.reduce((sum, fact) => sum + fact.weightGrams, 0))} 吨`
        }
      />
    </div>
  );
}
