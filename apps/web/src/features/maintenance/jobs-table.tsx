import { Button, Table } from 'antd';
import { listTime, type MaintenanceJob } from '@wms/contracts';
import { Card, SectionTitle, StatusTag } from '../../components/ui';
import { maintenanceCopy as t } from './copy';
import { durationText, jobTones } from './presentation';
import { restoreCopy as r } from './restore-copy';

export function JobsTable({
  jobs,
  loading,
  showReport,
}: {
  jobs: MaintenanceJob[];
  loading: boolean;
  showReport: (id: string) => void;
}) {
  return (
    <Card title={<SectionTitle title={t.jobs} />} extra={t.jobsHint} testId="maintenance-jobs">
      <Table<MaintenanceJob>
        rowKey="id"
        dataSource={jobs}
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: t.noJobs }}
        tableLayout="fixed"
        columns={[
          { title: r.kind, render: (_, job) => r.kinds[job.kind] },
          { title: t.started, dataIndex: 'startedAt', render: (value: string) => listTime(value) },
          {
            title: t.status,
            render: (_, job) => <StatusTag status={t.jobStatus[job.status]} type={jobTones[job.status]} />,
          },
          { title: t.elapsed, align: 'right', render: (_, job) => durationText(job.elapsedMs) },
          { title: t.operator, dataIndex: 'operator' },
          { title: t.reason, render: (_, job) => job.error ?? t.dash },
          {
            title: t.action,
            render: (_, job) =>
              job.kind === 'restore' ? (
                <Button type="link" onClick={() => showReport(job.id)}>
                  {r.view}
                </Button>
              ) : (
                t.dash
              ),
          },
        ]}
      />
    </Card>
  );
}
