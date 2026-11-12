import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { useFormErrors } from '../../components/use-form-errors';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { RequestError } from '../../components/RequestError';
import { Alert, Button, Drawer, Form, Input, Space } from 'antd';
import { tonnes, type CorrectionSummary, type CorrectionTarget } from '@wms/contracts';
import { gramsToTonnes, tonnesDeltaToGrams } from '../../lib/weight-input';
import { CorrectionLineFields, selectedCorrectionLine, type CorrectionFormValues } from './fields';
import { useCorrect } from './use-correct';

interface Props {
  target: CorrectionTarget;
  number: string;
  initial: CorrectionSummary;
  onClose: () => void;
}
export function CorrectionDrawer({ target, number, initial, onClose }: Props) {
  const modal = useLockedConfirm(),
    mutation = useCorrect(target);
  const [form] = Form.useForm<CorrectionFormValues>();
  const draft = useFormDraft(form, `correction-${target.kind}`, target.id);
  const lock = useSubmitLock();
  useFormErrors(mutation.error, form);
  async function submit(values: CorrectionFormValues) {
    const lines = values.lines.map((line, index) => ({
      originalLineId: initial.lines[index]!.originalLineId,
      ...(line.shipmentLineId ? { shipmentLineId: line.shipmentLineId } : {}),
      packages: line.packages,
      weightGrams: tonnesDeltaToGrams(line.weightTonnes),
    }));
    const packages = lines.reduce(
      (sum, line, index) =>
        sum + line.packages - selectedCorrectionLine(initial.lines[index]!, line.shipmentLineId).effective.packages,
      0,
    );
    const grams = lines.reduce(
      (sum, line, index) =>
        sum +
        line.weightGrams -
        selectedCorrectionLine(initial.lines[index]!, line.shipmentLineId).effective.weightGrams,
      0,
    );
    const confirmed = await modal.confirm({
      title: '确认提交数量更正？',
      content: `${number}：差额 ${packages >= 0 ? '+' : ''}${packages} 包 / ${grams >= 0 ? '+' : ''}${tonnes(grams)} 吨。原单数字保留，更正将立即记账。`,
      okText: '确认更正并入账',
      cancelText: '返回核对',
      okButtonProps: { type: 'default' },
      onOk: async () => {
        await mutation.mutateAsync({
          expectedCorrectionRevision: initial.revision,
          previousCorrectionId: initial.latest?.id ?? null,
          reason: values.reason,
          lines,
        });
        draft.saved();
      },
    });
    if (confirmed) onClose();
  }
  return (
    <Drawer
      open
      title={`数量更正 · ${number}`}
      size={560}
      mask={{ closable: false }}
      keyboard={!mutation.isPending}
      onClose={mutation.isPending ? undefined : () => void draft.leave(onClose)}
    >
      <Form
        form={form}
        onValuesChange={draft.change}
        layout="vertical"
        onFinish={(values) => lock.run(() => submit(values))}
        disabled={lock.busy || mutation.isPending}
        initialValues={{
          lines: initial.lines.map((line) => ({
            shipmentLineId: line.shipments?.[0]?.shipmentLineId,
            packages: (line.shipments?.[0]?.effective ?? line.effective).packages,
            weightTonnes: gramsToTonnes((line.shipments?.[0]?.effective ?? line.effective).weightGrams),
          })),
        }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            title="包数与吨数独立更正"
            description="可只改包数，保持吨数不变。商品、仓库、往来单位、单号与业务日期不可修改。"
          />
          {mutation.error && (
            <RequestError
              type="error"
              showIcon
              error={mutation.error}
              description="原值、填写内容和请求已保留。网络失败可重试；若原单版本已变化，请关闭抽屉并重新核对。"
            />
          )}
          {initial.lines.map((line, index) => (
            <CorrectionLineFields key={line.originalLineId} line={line} index={index} />
          ))}
          <Form.Item
            name="reason"
            label="更正原因"
            rules={[{ required: true, whitespace: true, message: '请填写更正原因' }, { max: 500 }]}
          >
            <Input.TextArea maxLength={500} showCount rows={3} />
          </Form.Item>
          <Space>
            <Button onClick={() => void draft.leave(onClose)} disabled={lock.busy || mutation.isPending}>
              取消
            </Button>
            <Button htmlType="submit" loading={lock.busy || mutation.isPending} disabled={lock.busy}>
              {lock.text('核对并提交')}
            </Button>
          </Space>
        </Space>
      </Form>
    </Drawer>
  );
}
