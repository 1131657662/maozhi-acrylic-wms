import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Result, Skeleton, Space } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import { ApiError } from '../../api/client';
import { handoffKeys } from './handoff-keys';
import { useHandoffCommand } from './use-handoff-command';
import { HandoffDetail } from './handoff-detail';
import { HandoffClients } from './handoff-clients';

export function HandoffPanel() {
  const [id, setId] = useState<string>();
  const { modal } = App.useApp();
  const { data, error, isLoading, refetch } = useQuery(handoffKeys.overview);
  const command = useHandoffCommand();
  return (
    <Card title="发布门禁 · 设备与待补传队列" extra={<Button onClick={() => void refetch()}>刷新交接清单</Button>}>
      {isLoading && <Skeleton active />}
      {error instanceof ApiError && error.status === 403 ? (
        <Result status="403" title="仅 Web 用户可核验交接" />
      ) : (
        error && (
          <RequestError
            type="error"
            error={error}
            action={<Button onClick={() => void refetch()}>重试交接清单</Button>}
          />
        )
      )}
      {data && (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="info"
            title="解除条件：设备清点完成 + 清单完整 + 原正文全部收妥 + 作业行明确 + 无后续旧协议请求"
            description="服务端无法发现从未联网的设备，仍须人工确认设备范围。此处清单按原单支持批量核验，确认交接不扣库存。"
          />
          {!data.devices.length ? (
            <Empty description="尚无设备上报交接清单；PDA 联网刷新完整目录后上报" />
          ) : (
            <ProTable
              rowKey="id"
              search={false}
              options={false}
              dataSource={data.devices}
              pagination={{ pageSize: 5 }}
              scroll={{ x: 1100 }}
              columns={[
                { title: '设备', dataIndex: 'deviceId', width: 180, ellipsis: true, fixed: 'left' },
                { title: '完整清单', render: (_, r) => `${r.registered}/${r.expectedCount}`, width: 100 },
                { title: '已收妥 / 未收妥', render: (_, r) => `${r.received} / ${r.unresolved}`, width: 150 },
                { title: '待归属', dataIndex: 'missingContext', width: 90 },
                {
                  title: '阻断原因',
                  render: (_, r) => (r.confirmedAt ? '已确认交接' : r.reasons.join('；') || '待 Web 确认交接'),
                  width: 240,
                },
                {
                  title: '操作',
                  valueType: 'option',
                  fixed: 'right',
                  width: 240,
                  render: (_, r) => [
                    <Button key="detail" onClick={() => setId(r.id)}>
                      查看记录
                    </Button>,
                    <Button
                      key="confirm"
                      disabled={!r.ready || !!r.confirmedAt}
                      loading={command.isPending}
                      onClick={() =>
                        modal.confirm({
                          title: '确认本设备清点和旧队列交接完成？',
                          content: `${r.expectedCount} 条原事实已收妥。确认只记录核验水位，后续旧请求会重新阻断。`,
                          okText: '确认交接完成',
                          cancelText: '返回核对',
                          onOk: () => command.mutateAsync({ id: r.id, action: 'confirm' }),
                        })
                      }
                    >
                      确认交接
                    </Button>,
                  ],
                },
              ]}
            />
          )}
          <HandoffClients data={data} />
        </Space>
      )}
      {command.error && <RequestError type="error" error={command.error} />}
      {id && <HandoffDetail key={id} id={id} onClose={() => setId(undefined)} />}
    </Card>
  );
}
