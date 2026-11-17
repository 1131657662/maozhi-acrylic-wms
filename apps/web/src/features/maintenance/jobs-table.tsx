import { Table } from 'antd';
import { listTime, type MaintenanceJob } from '@wms/contracts';
import { Card, SectionTitle, StatusTag } from '../../components/ui';
import { maintenanceCopy as t } from './copy';
import { durationText, jobTones } from './presentation';

export function JobsTable({ jobs, loading }: { jobs: MaintenanceJob[]; loading: boolean }) {
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
          { title: t.started, dataIndex: 'startedAt', render: (value: string) => listTime(value) },
          {
            title: t.status,
            render: (_, job) => <StatusTag status={t.jobStatus[job.status]} type={jobTones[job.status]} />,
          },
          { title: t.elapsed, align: 'right', render: (_, job) => durationText(job.elapsedMs) },
          { title: t.operator, dataIndex: 'operator' },
          { title: t.reason, render: (_, job) => job.error ?? t.dash },
        ]}
      />
    </Card>
  );
}
