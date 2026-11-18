import { Alert, Descriptions, Table } from 'antd';
import { MAINTENANCE, listTime, type RestoreReport as Report, type VerificationItem } from '@wms/contracts';
import { componentSize, spacing } from '../../theme/design-tokens';
import { restoreCopy as t } from './restore-copy';

export function RestoreReport({ report }: { report: Report }) {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, gap: spacing[16] }}
      data-testid="restore-report"
    >
      <Alert
        showIcon
        type={report.outcome === 'passed' ? 'success' : report.outcome === 'limited' ? 'warning' : 'error'}
        title={report.outcome === 'limited' && report.baselineAt ? t.legacyLimited : t.outcome[report.outcome]}
      />
      <Descriptions
        items={[
          {
            key: 'baseline',
            label: t.baselineAt,
            children: report.baselineAt ? listTime(report.baselineAt) : t.unknown,
          },
          {
            key: 'verified',
            label: t.verifiedAt,
            children: report.verifiedAt ? listTime(report.verifiedAt) : t.notVerified,
          },
        ]}
      />
      <Table<VerificationItem>
        rowKey="label"
        size="small"
        tableLayout="fixed"
        scroll={{ y: componentSize.reportTable }}
        dataSource={report.items}
        pagination={{ pageSize: MAINTENANCE.listLimit, showSizeChanger: false }}
        locale={{ emptyText: t.empty }}
        columns={[
          { title: t.item, dataIndex: 'label' },
          { title: t.expected, render: (_, row) => row.expected ?? t.unknown },
          { title: t.actual, render: (_, row) => row.actual ?? t.missing },
          { title: t.difference, dataIndex: 'difference' },
          { title: t.conclusion, render: (_, row) => t.conclusions[row.conclusion] },
        ]}
      />
    </div>
  );
}
