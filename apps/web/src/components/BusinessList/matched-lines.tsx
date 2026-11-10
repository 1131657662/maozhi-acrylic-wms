import { Table } from 'antd';
import { tonnes, type WebMatchedLine } from '@wms/contracts';

export function matchedSummary(lines: WebMatchedLine[] | undefined): string {
  if (!lines?.length) return '';
  const products = [...new Set(lines.map((line) => `${line.productCode}/${line.productName}`))].join('、');
  const packages = lines.reduce((sum, line) => sum + line.packages, 0);
  const weightGrams = lines.reduce((sum, line) => sum + line.weightGrams, 0);
  return `命中：${products} · ${packages} 包 · ${tonnes(weightGrams)} 吨`;
}

export function MatchedLines({ lines }: { lines: WebMatchedLine[] }) {
  return (
    <Table<WebMatchedLine>
      data-testid="matched-lines-table"
      rowKey="lineId"
      size="small"
      pagination={false}
      dataSource={lines}
      columns={[
        { title: '商品编码', dataIndex: 'productCode' },
        { title: '商品名称', dataIndex: 'productName' },
        { title: '包数', dataIndex: 'packages', align: 'right' as const },
        {
          title: '重量（吨）',
          dataIndex: 'weightGrams',
          align: 'right' as const,
          render: (value: number) => tonnes(value),
        },
      ]}
    />
  );
}
