import { Collapse, Descriptions, Table } from 'antd';
import type { DateCorrectionHistory } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';
import { dateCorrectionCopy as text, DATE_CORRECTION_UI as ui } from './copy';

export function DateHistory({ data }: { data: DateCorrectionHistory }) {
  return (
    <Collapse
      items={[
        {
          key: 'history',
          label: text.history,
          children: (
            <>
              <Descriptions
                items={[{ key: 'original', label: text.original, children: data.businessDate ?? text.unknown }]}
              />
              <Table
                rowKey="id"
                dataSource={data.records}
                pagination={false}
                scroll={{ x: ui.historyWidth }}
                locale={{ emptyText: text.empty }}
                aria-label={text.changes}
                columns={[
                  { title: text.change, key: 'dates', render: (_, row) => `${row.beforeDate} → ${row.afterDate}` },
                  { title: text.reason, dataIndex: 'reason' },
                  { title: text.actor, dataIndex: 'actor' },
                  { title: text.time, dataIndex: 'createdAt', render: (value: string) => formatTime(value) },
                ]}
              />
            </>
          ),
        },
      ]}
    />
  );
}
