import { useFormErrors } from '../../components/use-form-errors';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { businessCopy } from '../../business-copy';
import { RequestError } from '../../components/RequestError';
import { Form, Alert, Drawer } from 'antd';
import { ProForm, ProFormTextArea } from '@ant-design/pro-components';
import type { Stocktake } from '@wms/contracts';
import { useVoidStocktake } from './use-void-stocktake';

export function VoidStocktakeDrawer({ take, onClose }: { take: Stocktake; onClose: () => void }) {
  const { mutateAsync: voidTake, isPending: isVoiding, error: voidError } = useVoidStocktake();
  const [form] = Form.useForm();
  const draft = useFormDraft(form, `stocktake-void`, take.id);
  useFormErrors(voidError, form);
  async function submit(v: { reason: string }) {
    try {
      await voidTake({ take, reason: v.reason });
      draft.saved();
      onClose();
      return true;
    } catch {
      return false;
    }
  }
  return (
    <Drawer
      open
      size={480}
      title="作废盘点并释放暂停"
      onClose={isVoiding ? undefined : () => void draft.leave(onClose)}
      mask={{ closable: false }}
      keyboard={!isVoiding}
    >
      <Alert
        showIcon
        type="warning"
        title="作废不修改库存、不写库存流水"
        description={businessCopy.stocktakeVoidDrawer1}
      />
      {voidError && (
        <RequestError
          type="error"
          error={voidError}
          description="原因已保留。网络失败可重试；盘点变更时关闭抽屉、刷新详情再核对。"
        />
      )}
      <ProForm<{ reason: string }>
        form={form}
        onValuesChange={draft.change}
        onFinish={submit}
        loading={isVoiding}
        disabled={isVoiding}
        submitter={{
          resetButtonProps: false,
          searchConfig: { submitText: '确认作废盘点' },
          submitButtonProps: { danger: true },
        }}
      >
        <ProFormTextArea
          name="reason"
          label="作废原因"
          rules={[{ required: true, whitespace: true }]}
          fieldProps={{ maxLength: 500, rows: 3 }}
        />
      </ProForm>
    </Drawer>
  );
}
