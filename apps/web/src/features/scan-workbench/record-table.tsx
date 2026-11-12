import { useState } from 'react';
import { Flex, Select, Table, Tag, Typography } from 'antd';
import { tonnes, listTime, type Detail } from '@wms/contracts';
import { text, sourceText, attributionText, COUNTING_TABLE_WIDTH } from './copy';

export function CountingRecords({ order }: { order: Detail }) {
  const [source, setSource] = useState('all');
  const facts = [...order.facts]
    .filter((f) => source === 'all' || f.source === source)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id));
  return (
    <Flex vertical gap="small">
      <Select
        aria-label={text.origin}
        value={source}
        onChange={setSource}
        options={[
          { value: 'all', label: text.all },
          ...Object.entries(sourceText).map(([value, label]) => ({ value, label })),
        ]}
      />
      <Table
        rowKey="id"
        size="small"
        dataSource={facts}
        locale={{ emptyText: text.empty }}
        scroll={{ x: COUNTING_TABLE_WIDTH }}
        columns={[
          {
            title: `${text.time} / ${text.actor}`,
            width: 130,
            render: (_, f) => (
              <>
                {listTime(f.scannedAt)
                  .split(' ')
                  .map((part) => (
                    <div key={part}>{part}</div>
                  ))}
                <Typography.Text type="secondary">{f.recordedBy}</Typography.Text>
              </>
            ),
          },
          { title: text.barcode, dataIndex: 'barcode', width: 160 },
          {
            title: text.product,
            width: 140,
            render: (_, f) => (
              <>
                <div>{f.productName ?? text.unknown}</div>
                <Typography.Text type="secondary">{f.productCode}</Typography.Text>
              </>
            ),
          },
          { title: text.weight, width: 90, render: (_, f) => tonnes(f.weightGrams) },
          {
            title: `${text.origin} / ${text.attribution}`,
            width: 140,
            render: (_, f) => (
              <>
                <div>{f.source ? sourceText[f.source] : text.unknown}</div>
                {f.attribution ? <Tag>{attributionText[f.attribution]}</Tag> : text.unknown}
              </>
            ),
          },
        ]}
      />
    </Flex>
  );
}
