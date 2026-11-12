import { Form, Modal } from 'antd';
import type { ActualQuantity, ShipmentList } from '@wms/contracts';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useFormErrors } from '../../components/use-form-errors';
import { RequestError } from '../../components/RequestError';
import { ActualConfirmContent } from './actual-confirm-content';
import { useConfirm } from './use-confirm';
import { shipmentCopy as text, SHIPMENT_UI as ui } from './shipment-copy';

interface Props {
  open: boolean;
  id: string;
  data: ShipmentList;
  lines: ActualQuantity[];
  saved: () => void;
  close: () => void;
}
interface Reasons {
  vehicleNo: string;
  lines: { overageReason?: string }[];
}

export function ShipmentDialog({ open, id, data, lines, saved, close }: Props) {
  const [form] = Form.useForm<Reasons>();
  const lock = useSubmitLock();
  const { mutateAsync: confirm, error: confirmError, reset } = useConfirm(saved);
  useFormErrors(confirmError, form);
  async function submit() {
    try {
      await lock.run(async () => {
        const values = await form.validateFields();
        await confirm({
          id,
          input: {
            revision: data.revision,
            digest: data.digest,
            vehicleNo: values.vehicleNo,
            lines: lines.map((line, index) => ({
              ...line,
              overageReason: values.lines?.[index]?.overageReason?.trim(),
            })),
          },
        });
      });
    } catch {
      /* RequestError and field errors preserve the editable confirmation. */
    }
  }
  return (
    <Modal
      open={open}
      title={text.review}
      width={ui.modalWidth}
      onCancel={close}
      onOk={() => void submit()}
      okText={lock.text(text.confirm)}
      okButtonProps={{ ...lock.button, 'aria-label': lock.text(text.confirm), 'aria-busy': lock.busy }}
      cancelText={text.cancel}
      cancelButtonProps={{ disabled: lock.busy }}
      keyboard={!lock.busy}
      closable={!lock.busy}
      mask={{ closable: false }}
    >
      <Form
        form={form}
        layout="vertical"
        disabled={lock.busy}
        initialValues={{ vehicleNo: data.vehicleNo }}
        onValuesChange={reset}
      >
        <ActualConfirmContent data={data} lines={lines} />
        {confirmError && <RequestError error={confirmError} />}
      </Form>
    </Modal>
  );
}
