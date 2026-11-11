import { RequestError } from '../../components/RequestError';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Empty, Result, Skeleton, Space } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import { ApiError } from '../../api/client';
import { handoffKeys } from './handoff-keys';
import { HandoffBind } from './handoff-bind';

export function HandoffDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, isLoading, refetch } = useQuery(handoffKeys.detail(id));
  return (
    <Drawer title="设备交接明细 · 原事实保留" open onClose={onClose} size={960}>
      {isLoading && <Skeleton active />}
      {error instanceof ApiError && error.status === 403 ? (
        <Result status="403" title="仅 Web 用户可核验交接" />
      ) : (
        error && (
          <RequestError
            type="error"
            error={error}
            action={<Button onClick={() => void refetch()}>重试交接明细</Button>}
          />
        )
      )}
      {data && (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type={data.summary.ready ? 'success' : 'warning'}
            title={`已收妥 ${data.summary.received}/${data.summary.expectedCount} · 未收妥 ${data.summary.unresolved}`}
            description={data.summary.reasons.join('；') || '全部事实已收妥，可在设备列表确认交接。'}
          />
          <Button onClick={() => void refetch()}>刷新收妥结果</Button>
          {!data.summary.confirmedAt && <HandoffBind id={id} records={data.items} />}
          {!data.total ? (
            <Empty description="此设备上报空队列，仍须确认设备清点完成" />
          ) : (
            <ProTable
              rowKey="factId"
              search={false}
              options={false}
              dataSource={data.items}
              pagination={{ pageSize: 50 }}
              scroll={{ x: 850 }}
              columns={[
                { title: '原单', dataIndex: 'planId', width: 150 },
                { title: '条码', dataIndex: 'barcode', width: 160 },
                {
                  title: '原版/重量',
                  render: (_, r) => `v${r.catalogVersion} / ${r.weightGrams / 1000} kg`,
                  width: 150,
                },
                {
                  title: '收妥核验',
                  render: (_, r) =>
                    r.payloadMatches ? '原正文一致 / 已收妥' : r.received ? '正文冲突，原记录保留' : '未收到',
                  width: 180,
                },
                { title: 'ERP 作业行', render: (_, r) => r.context?.outboundLineId ?? '待批量确认', width: 210 },
              ]}
            />
          )}
        </Space>
      )}
    </Drawer>
  );
}
