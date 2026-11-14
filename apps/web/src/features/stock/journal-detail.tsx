import { businessCopy } from '../../business-copy';
import { Alert, Button, Drawer } from 'antd';
import { useState } from 'react';
import { ProDescriptions } from '@ant-design/pro-components';
import { tonnes, type SourceJournalRow } from '@wms/contracts';
import { JournalTypeTag } from '../../components/JournalTypeTag';

export function JournalDetail({ row }: { row: Omit<SourceJournalRow, 'source'> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="link" onClick={() => setOpen(true)}>
        查看前后值
      </Button>
      <Drawer title="库存流水依据" open={open} onClose={() => setOpen(false)} size={560}>
        <Alert
          type="info"
          title={
            row.evidenceKind === 'transaction'
              ? businessCopy.stockJournalDetail1
              : row.evidenceKind === 'source-snapshot'
                ? businessCopy.stockJournalDetail2
                : '旧记录未保存前后值，不推算历史'
          }
        />
        <ProDescriptions
          column={1}
          dataSource={row}
          columns={[
            { title: '操作类型', render: () => <JournalTypeTag type={row.operationType} /> },
            {
              title: '调整前',
              render: () =>
                row.before ? `${row.before.packages} 包 / ${tonnes(row.before.weightGrams)} 吨` : '未记录',
            },
            { title: '本次变化', render: () => `${row.packagesDelta} 包 / ${tonnes(row.weightDeltaGrams)} 吨` },
            {
              title: '调整后',
              render: () => (row.after ? `${row.after.packages} 包 / ${tonnes(row.after.weightGrams)} 吨` : '未记录'),
            },
            { title: '原因', render: () => row.reason ?? '历史记录未提供' },
          ]}
        />
      </Drawer>
    </>
  );
}
