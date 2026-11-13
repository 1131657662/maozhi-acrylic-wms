import { RequestError } from '../../components/RequestError';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Result } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import { tonnes, type SourceJournalRow } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { JournalTypeTag } from '../../components/JournalTypeTag';
import { formatTime } from '../../lib/format-time';
import { Card, EmptyState, SectionTitle } from '../../components/ui';

import { stockKeys } from './keys';
import { JournalDetail } from './journal-detail';
import { stockPageCopy } from './stock-copy';

function JournalSection({ children }: { children: ReactNode }) {
  return (
    <section data-testid="stock-recent-movements">
      <Card title={<SectionTitle title={stockPageCopy.recentSection} />}>{children}</Card>
    </section>
  );
}

export function StockJournal() {
  const {
    data: journalRows,
    error: journalError,
    isLoading: isLoadingJournal,
    refetch: reloadJournal,
  } = useQuery(stockKeys.journal('inventory'));
  if (journalError instanceof ApiError && journalError.status === 403)
    return (
      <JournalSection>
        <Result status="403" title="无权查看库存流水" />
      </JournalSection>
    );
  if (journalError)
    return (
      <JournalSection>
        <RequestError
          type="error"
          error={journalError}
          action={<Button onClick={() => void reloadJournal()}>重试</Button>}
        />
      </JournalSection>
    );
  return <JournalTable rows={journalRows} loading={isLoadingJournal} />;
}

function JournalTable({ rows, loading }: { rows?: SourceJournalRow[]; loading: boolean }) {
  return (
    <JournalSection>
      <ProTable<SourceJournalRow>
        rowKey="id"
        dataSource={rows}
        loading={loading}
        search={false}
        options={false}
        pagination={false}
        scroll={{ x: 1100 }}
        locale={{ emptyText: <EmptyState description={stockPageCopy.emptyJournal} /> }}
        columns={[
          { title: '类型', width: 180, render: (_, row) => <JournalTypeTag type={row.type} /> },
          { title: '仓库', dataIndex: 'warehouseCode' },
          { title: '商品', dataIndex: 'productCode' },
          {
            title: '包数变化',
            render: (_, row) => <span data-testid="journal-row-packages">{row.packagesDelta}</span>,
          },
          {
            title: '重量变化（吨）',
            render: (_, row) => <span data-testid="journal-row-tonnes">{tonnes(row.weightDeltaGrams)}</span>,
          },
          { title: '时间', render: (_, row) => formatTime(row.createdAt) },
          { title: '依据', valueType: 'option', render: (_, row) => <JournalDetail row={row} /> },
        ]}
      />
    </JournalSection>
  );
}
