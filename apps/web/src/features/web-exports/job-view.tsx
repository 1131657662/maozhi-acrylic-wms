import { Alert, Button, Descriptions, Progress, Space, Table } from 'antd';
import { listTime, type ExportJob } from '@wms/contracts';
import { useCancelExport } from './use-cancel-export';

export function ExportJobView({ job }: { job: ExportJob }) {
  const { mutate: cancel, isPending: cancelling, error: cancelError } = useCancelExport();
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <div>
        本任务：{{ inbound: '入库', outbound: '出库', stock: 'ERP 库存', audit: '操作日志' }[job.kind]}
        {' · '}
        {{ all: '全部筛选结果', page: '当前页', selected: '选中记录' }[job.scope]}
        {' · '}
        {listTime(job.createdAt)}
      </div>
      <div role="status">
        {job.state === 'running'
          ? `正在生成 ${job.processed} / ${job.total} 条`
          : `导出${job.state === 'ready' ? '完成' : job.state === 'cancelled' ? '已取消' : '失败'} · ${job.processed} 条`}
      </div>
      {job.state === 'running' && (
        <>
          <Progress percent={job.total ? Math.min(99, Math.floor((job.processed * 100) / job.total)) : 0} />
          <Button onClick={() => cancel(job.id)} loading={cancelling}>
            取消导出
          </Button>
        </>
      )}
      {job.error && <Alert type={job.state === 'failed' ? 'error' : 'info'} title={job.error} showIcon />}
      {cancelError && <Alert type="error" title={cancelError.message} />}
      {job.state === 'ready' && <CompletedExport job={job} />}
    </Space>
  );
}
function CompletedExport({ job }: { job: ExportJob }) {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Alert
        type="success"
        title={`完整文件已生成：${job.total} 条。合计仅包含本次导出范围。`}
        description="文件保留 24 小时；可继续操作列表，下载中断后可重新下载同一文件。"
      />
      <Button type="primary" href={`/api/v1/web/exports/${job.id}/download`} target="_blank" rel="noopener">
        下载 XLSX
      </Button>
      <Descriptions
        title="本次导出合计"
        size="small"
        column={1}
        items={job.columns
          .filter((c) => job.totals[c.key] !== undefined)
          .map((c) => ({
            key: c.key,
            label: c.label,
            children: <span data-testid={'export-total-' + c.key}>{job.totals[c.key]}</span>,
          }))}
      />
      <Table
        size="small"
        pagination={false}
        scroll={{ x: 'max-content', y: 280 }}
        dataSource={job.preview.map((cells, i) => ({ id: i, cells }))}
        rowKey="id"
        columns={job.columns.map((c, i) => ({
          title: c.label,
          key: c.key,
          width: 160,
          render: (_: unknown, row: { cells: string[] }) => row.cells[i],
        }))}
      />
      <span>预览前 {job.preview.length} 条，列顺序与文件一致。时间为上海时间。</span>
    </Space>
  );
}
