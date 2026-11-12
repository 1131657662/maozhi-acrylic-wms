import { Alert, Form, Input, Modal } from 'antd';
import type { ShipmentList } from '@wms/contracts';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { RequestError } from '../../components/RequestError';
import { useFormErrors } from '../../components/use-form-errors';
import { useShortClose } from './use-short-close';
import { shipmentCopy as text, SHIPMENT_UI as ui } from './shipment-copy';

interface Props {
  id: string;
  number: string;
  snapshot: ShipmentList;
  close: () => void;
}
export function ShortCloseDialog({ id, number, snapshot, close }: Props) {
  const [form] = Form.useForm<{ reason: string }>();
  const lock = useSubmitLock();
  const { mutateAsync: shortClose, error: shortError } = useShortClose(id);
  useFormErrors(shortError, form);
  async function submit() {
    try {
      await lock.run(async () => {
        const { reason } = await form.validateFields();
        await shortClose({ snapshot, reason: reason.trim() });
        close();
      });
    } catch {
      /* Keep the reason and server error visible for a safe retry. */
    }
  }
  return (
    <Modal
      open
      title={`${text.shortTitle} · ${number}`}
      width={ui.modalWidth}
      onCancel={close}
      onOk={() => void submit()}
      okText={lock.text(text.shortConfirm)}
      okButtonProps={{ ...lock.button, danger: true }}
      cancelText={text.cancel}
      cancelButtonProps={{ disabled: lock.busy }}
      keyboard={!lock.busy}
      closable={!lock.busy}
      mask={{ closable: false }}
    >
      <Alert
        type="warning"
        title={text.shortHint}
        description={`${text.closedAmount}：${text.quantity(snapshot.remainingPackages, snapshot.remainingWeightGrams)}`}
      />
      <Form form={form} layout="vertical" disabled={lock.busy}>
        <Form.Item
          name="reason"
          label={text.shortReason}
          rules={[{ required: true, whitespace: true, message: text.reasonRequired }]}
        >
          <Input.TextArea autoFocus maxLength={ui.reasonMax} placeholder={text.shortPlaceholder} autoSize />
        </Form.Item>
        {shortError && <RequestError error={shortError} />}
      </Form>
    </Modal>
  );
}
