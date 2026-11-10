import { RequestError } from '../../components/RequestError';
import { Alert, Button, Popconfirm, Space } from 'antd';
import { tonnes, type InboundReceipt } from '@wms/contracts';
import { useConfirmReceipt } from './use-confirm-receipt';

export function InboundConfirmation({ receipt }: { receipt: InboundReceipt }) {
  const confirm = useConfirmReceipt(receipt.id);
  if (['cancelled', 'voided'].includes(receipt.status ?? '')) return null;
  if (receipt.postingState === 'legacy')
    return (
      <Alert type="info" showIcon title="历史单据 · 仅供查阅" description="保留原始状态和库存，不在此重复确认入账。" />
    );
  if (receipt.postingState === 'confirmed')
    return <Alert type="success" showIcon title="已确认入库" description="库存已更新，入账记录已保存。" />;
  const pending = receipt.status === 'pending';
  return (
    <Space orientation="vertical" size="middle">
      <Alert
        type="info"
        showIcon
        title="待确认 · 尚未计入库存"
        description={`核对实物后确认，将向 ${receipt.warehouseName} 增加 ${receipt.packages} 包、${tonnes(receipt.weightGrams)} 吨；确认与流水同时入账。`}
      />
      {confirm.error && (
        <RequestError
          type="error"
          showIcon
          error={confirm.error}
          description="操作失败可重试；重复提交不会重复入账。"
        />
      )}
      <Popconfirm
        title="确认本单实物及总重量已核对？"
        description="确认后增加库存并保存审计记录；仅误确认可核对依赖后撤销，更正与退货另行处理。"
        okText="确认入账"
        cancelText="返回核对"
        onConfirm={() => confirm.mutateAsync()}
        disabled={!pending || confirm.isPending}
      >
        <Button type="primary" loading={confirm.isPending} disabled={!pending}>
          核对并确认入库
        </Button>
      </Popconfirm>
    </Space>
  );
}
