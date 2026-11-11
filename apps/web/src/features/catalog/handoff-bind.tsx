import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Select, Space } from 'antd';
import type { z } from 'zod';
import { handoffRecordSchema } from '@wms/contracts';
import { handoffKeys } from './handoff-keys';
import { useHandoffCommand } from './use-handoff-command';

export function HandoffBind({ id, records }: { id: string; records: z.infer<typeof handoffRecordSchema>[] }) {
  const [plan, setPlan] = useState<string>();
  const [line, setLine] = useState<string>();
  const query = useQuery({ ...handoffKeys.plan(plan ?? ''), enabled: !!plan });
  const command = useHandoffCommand();
  const modal = useLockedConfirm();
  const pending = records.filter((r) => !r.context);
  const rows = pending.filter((r) => r.planId === plan);
  if (!pending.length) return null;
  const bind = () =>
    modal.confirm({
      title: `将原单 ${plan} 的 ${rows.length} 条记录绑定到所选 ERP 行？`,
      content: '只补齐作业上下文；原 UUID、正文、目录版本和重量不改变。其他单据的记录不会绑定。',
      okText: '批量确认原单作业行',
      cancelText: '返回核对',
      onOk: () =>
        command.mutateAsync({
          id,
          action: 'bind',
          body: { factIds: rows.map((r) => r.factId), outboundLineId: line! },
        }),
    });
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Alert type="warning" title={`待确认原单作业行 ${pending.length} 条：可按单批量处理，无需逐条点击`} />
      <label htmlFor="handoff-plan">原出库单</label>
      <Select
        id="handoff-plan"
        value={plan}
        onChange={(v) => {
          setPlan(v);
          setLine(undefined);
        }}
        style={{ width: '100%' }}
        placeholder="选择原单"
        options={[...new Set(pending.map((r) => r.planId))].map((value) => ({ value, label: value }))}
      />
      <label htmlFor="handoff-line">ERP 作业行</label>
      <Select
        id="handoff-line"
        value={line}
        onChange={setLine}
        loading={query.isLoading}
        style={{ width: '100%' }}
        placeholder="选择原单内 ERP 行"
        options={query.data?.lines.map((l) => ({
          value: l.id,
          label: `${l.productCode} · ${l.productName} · ${l.plannedPackages} 包`,
        }))}
      />
      {query.error && (
        <RequestError
          type="error"
          error={query.error}
          action={<Button onClick={() => void query.refetch()}>重试作业行</Button>}
        />
      )}
      {command.error && <RequestError type="error" error={command.error} />}
      <Button disabled={!line || !rows.length} loading={command.isPending} onClick={bind}>
        批量确认本单 {rows.length} 条
      </Button>
    </Space>
  );
}
