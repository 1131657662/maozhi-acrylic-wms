import { RequestError } from '../../components/RequestError';
import { Button } from 'antd';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { formCopy } from '../../components/form-protection/copy';
import { tonnes, type Detail } from '@wms/contracts';
import { useConfirm } from './use-confirm';
export function Confirm({ order }: { order: Detail }) {
  const modal = useLockedConfirm();
  const { mutateAsync: confirm, isPending: isConfirming, error: confirmError } = useConfirm();
  if (['cancelled', 'voided'].includes(order.status)) return null;
  function ask(): void {
    modal.confirm({
      title: '确认实际出库',
      content: `将扣减 ${order.actualPackages} 包、${tonnes(order.actualWeightGrams)} 吨，并记录库存流水。请确认车辆及实物已核对。`,
      okText: '确认出库',
      cancelText: '返回核对',
      onOk: () => confirm(order),
    });
  }
  return (
    <div className="confirm-bar">
      <span>已扫码不代表已出库；确认后才扣减库存。</span>
      {confirmError && <RequestError type="error" error={confirmError} />}
      <Button
        type={order.status === 'frozen' ? 'primary' : 'default'}
        size="large"
        disabled={order.status !== 'frozen' || modal.busy}
        loading={isConfirming || modal.busy}
        onClick={ask}
      >
        {modal.busy ? formCopy.submitting : order.status === 'confirmed' ? '已确认出库' : '核对并确认出库'}
      </Button>
    </div>
  );
}
