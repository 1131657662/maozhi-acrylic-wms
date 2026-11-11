import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { formCopy } from '../../components/form-protection/copy';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { Alert, Button, Select, Space } from 'antd';
import type { z } from 'zod';
import { handoffOverviewSchema } from '@wms/contracts';
import { useHandoffCommand } from './use-handoff-command';

export function HandoffClients({ data }: { data: z.infer<typeof handoffOverviewSchema> }) {
  const [id, setId] = useState<string>();
  const command = useHandoffCommand();
  const modal = useLockedConfirm();
  if (!data.clients.length) return <Alert type="success" title="没有未核验的旧协议客户端活动" />;
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Alert
        type="warning"
        title={`还有 ${data.clients.length} 个旧协议客户端活动未解除`}
        description="已自动关联设备号与保留的登录会话。无法自动关联的会话，须完成实物盘点后明确归属；关联会记审计，旧计数不清零。若设备已确认，请先在 PDA 点“重新清点交接”，上报当前完整队列。"
      />
      <label htmlFor="handoff-device">已实物盘点的交接设备</label>
      <Select
        id="handoff-device"
        value={id}
        onChange={setId}
        placeholder="选择已核实归属的设备"
        style={{ width: '100%' }}
        options={data.devices
          .filter((d) => !d.confirmedAt)
          .map((d) => ({ value: d.id, label: `${d.deviceId} · ${d.expectedCount} 条` }))}
      />
      {data.clients.map((c) => (
        <Space key={c.clientKey} wrap>
          <span style={{ overflowWrap: 'anywhere' }}>
            {c.clientKey} · {c.requests} 次 · {c.lastSeen}
          </span>
          <Button
            disabled={!id}
            loading={command.isPending}
            onClick={() =>
              modal.confirm({
                title: '确认此旧客户端属于所选已盘点设备？',
                content: '必须核对设备及队列；此操作仅登记对应关系，未收妥事实仍阻止发布。',
                okText: '确认归属并记录审计',
                cancelText: '取消',
                onOk: () => command.mutateAsync({ id: id!, action: 'clients', body: { clientKey: c.clientKey } }),
              })
            }
          >
            {modal.busy ? formCopy.submitting : '关联已盘点设备'}
          </Button>
        </Space>
      ))}
      {command.error && <RequestError type="error" error={command.error} />}
    </Space>
  );
}
