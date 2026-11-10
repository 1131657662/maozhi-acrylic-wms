import { RequestError } from '../../components/RequestError';
import { Button, Modal } from 'antd';
import { tonnes, type Detail } from '@wms/contracts';
import { useConfirm } from './use-confirm';
export function Confirm({ order }: { order: Detail }) {
  const [modal, contextHolder] = Modal.useModal();
  const { mutate: confirm, isPending: isConfirming, error: confirmError } = useConfirm();
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
      {contextHolder}
      <span>冻结 ≠ 出库；确认后写入库存流水。</span>
      {confirmError && <RequestError type="error" error={confirmError} />}
      <Button
        type={order.status === 'frozen' ? 'primary' : 'default'}
        size="large"
        disabled={order.status !== 'frozen'}
        loading={isConfirming}
        onClick={ask}
      >
        {order.status === 'confirmed' ? '已确认出库' : '核对并确认出库'}
      </Button>
    </div>
  );
}
