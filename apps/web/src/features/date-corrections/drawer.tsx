import { App, Button, Drawer, Form, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { backdateThreshold, shanghaiToday, type CorrectionTarget, type DateCorrectionHistory } from '@wms/contracts';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { RequestError } from '../../components/RequestError';
import { useCorrectDate } from './use-correct-date';
import { DateFields } from './fields';
import { dateCorrectionCopy as text, DATE_CORRECTION_UI as ui } from './copy';

interface Props {
  target: CorrectionTarget;
  initial: DateCorrectionHistory;
  onClose: () => void;
}
interface Values {
  afterDate: Dayjs;
  reason: string;
}
export function DateCorrectionDrawer({ target, initial, onClose }: Props) {
  const [form] = Form.useForm<Values>(),
    mutation = useCorrectDate(target),
    lock = useSubmitLock();
  const modal = useLockedConfirm(),
    { message } = App.useApp();
  const draft = useFormDraft(form, `date-correction-${target.kind}`, target.id);
  async function submit(values: Values) {
    const afterDate = values.afterDate.format('YYYY-MM-DD'),
      old = afterDate < backdateThreshold(shanghaiToday());
    const confirmed = await modal.confirm({
      title: old ? text.oldConfirm : text.confirm,
      content: `${initial.effectiveBusinessDate} → ${afterDate}。${text.effect}`,
      okText: text.confirmSubmit,
      cancelText: text.return,
      okButtonProps: { type: 'default' },
      onOk: async () => {
        await mutation.mutateAsync({
          afterDate,
          reason: values.reason,
          expectedRevision: initial.revision,
          backdateConfirmed: old,
        });
        draft.saved();
      },
    });
    if (confirmed) {
      void message.success(text.success);
      onClose();
    }
  }
  const busy = lock.busy || mutation.isPending;
  return (
    <Drawer
      open
      title={text.edit}
      size={ui.drawerWidth}
      mask={{ closable: false }}
      keyboard={!busy}
      closable={{ disabled: busy }}
      onClose={() => {
        if (!busy) void draft.leave(onClose);
      }}
    >
      <Form
        form={form}
        layout="vertical"
        disabled={busy}
        onValuesChange={draft.change}
        initialValues={{ afterDate: initial.effectiveBusinessDate ? dayjs(initial.effectiveBusinessDate) : undefined }}
        onFinish={(values) => void lock.run(() => submit(values))}
      >
        {mutation.error && <RequestError type="error" showIcon error={mutation.error} description={text.failed} />}
        <DateFields current={initial.effectiveBusinessDate} />
        <Space>
          <Button disabled={busy} onClick={() => void draft.leave(onClose)}>
            {text.cancel}
          </Button>
          <Button htmlType="submit" loading={busy} disabled={busy}>
            {text.submit}
          </Button>
        </Space>
      </Form>
    </Drawer>
  );
}
