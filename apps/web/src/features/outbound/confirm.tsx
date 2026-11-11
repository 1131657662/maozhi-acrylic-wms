import { useState } from 'react';
import { App, Alert, Button, Card, Form } from 'antd';
import { type Detail, type ActualQuantity, outboundPrefillSchema } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { formCopy } from '../../components/form-protection/copy';
import { useFormErrors } from '../../components/use-form-errors';
import { request } from '../../api/client';
import { tonnesDeltaToGrams } from '../../lib/weight-input';
import { useConfirm } from './use-confirm';
import { ActualLines, type ActualForm } from './actual-lines';
import { ActualConfirmContent } from './actual-confirm-content';
import { actualText as text } from './actual-text';

export function Confirm({ order }: { order: Detail }) {
  const modal = useLockedConfirm();
  const { message } = App.useApp();
  const [form] = Form.useForm<ActualForm>();
  const draft = useFormDraft(form, 'outbound-actual', order.id);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillError, setPrefillError] = useState<unknown>();
  const { mutateAsync: confirm, isPending: isConfirming, error: confirmError } = useConfirm(draft.saved);
  useFormErrors(confirmError, form);
  const editable = ['open', 'frozen'].includes(order.status);
  async function prefill() {
    setPrefilling(true);
    setPrefillError(undefined);
    try {
      const result = await request(`/outbound/${order.id}/prefill`, outboundPrefillSchema);
      form.setFieldsValue({
        lines: order.lines.map((line) => {
          const scan = result.lines.find((item) => item.lineId === line.id)!;
          return { actualPackages: scan.scanPackages, actualWeightTonnes: scan.scanWeightGrams / 1_000_000 };
        }),
      });
      draft.change();
    } catch (error) {
      setPrefillError(error);
    } finally {
      setPrefilling(false);
    }
  }
  async function ask() {
    let values: ActualForm;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const lines: ActualQuantity[] = values.lines.map((line, index) => ({
      lineId: order.lines[index]!.id,
      actualPackages: line.actualPackages!,
      actualWeightGrams: tonnesDeltaToGrams(line.actualWeightTonnes!),
    }));
    if (lines.every((line) => !line.actualPackages && !line.actualWeightGrams)) {
      void message.warning(text.allZero);
      return;
    }
    modal.confirm({
      title: text.titleConfirm,
      content: <ActualConfirmContent order={order} lines={lines} />,
      okText: text.confirm,
      cancelText: text.cancel,
      onOk: async () => {
        await confirm({ order, lines });
      },
    });
  }
  return (
    <Card
      title={text.title}
      extra={
        editable && (
          <Button onClick={() => void prefill()} loading={prefilling} disabled={modal.busy}>
            {text.prefill}
          </Button>
        )
      }
    >
      <Form
        form={form}
        initialValues={{
          lines: order.lines.map((line) => ({
            actualPackages: line.scanPackages ?? undefined,
            actualWeightTonnes: line.scanWeightGrams == null ? undefined : line.scanWeightGrams / 1_000_000,
          })),
        }}
        onValuesChange={draft.change}
      >
        {editable && <Alert type="info" title={text.review} />}
        <ActualLines order={order} form={form} editable={editable} />
        {Boolean(confirmError || prefillError) && <RequestError error={confirmError || prefillError} />}
        {editable ? (
          <div className="confirm-bar">
            <span>{text.notice}</span>
            <Button
              type="primary"
              disabled={modal.busy || isConfirming}
              loading={modal.busy || isConfirming}
              onClick={() => void ask()}
              onKeyDown={(event) => {
                if (event.repeat) event.preventDefault();
              }}
            >
              {modal.busy || isConfirming ? formCopy.submitting : text.ask}
            </Button>
          </div>
        ) : (
          order.status === 'confirmed' && <Button disabled>{text.done}</Button>
        )}
      </Form>
    </Card>
  );
}
