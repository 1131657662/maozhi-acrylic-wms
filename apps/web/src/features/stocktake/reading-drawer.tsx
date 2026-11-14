import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useFormErrors } from '../../components/use-form-errors';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { businessCopy } from '../../business-copy';
import { useState } from 'react';
import { Form, Alert, Button, Drawer } from 'antd';
import { ProForm, ProFormDigit } from '@ant-design/pro-components';
import { tonnes, publicStocktakeLinesSchema, type PublicStocktakeLine } from '@wms/contracts';
import { tonnesDeltaToGrams } from '../../lib/weight-input';
import { useSaveReading } from './use-save-reading';
import { request } from '../../api/client';

export function ReadingDrawer({ id, line, onClose }: { id: string; line: PublicStocktakeLine; onClose: () => void }) {
  const [current, setCurrent] = useState(line),
    [reloadError, setReloadError] = useState('');
  const { mutateAsync: save, isPending: isSaving, error: saveError } = useSaveReading();
  const [form] = Form.useForm();
  const draft = useFormDraft(form, `stocktake-reading`, `${id}:${line.productCode}`);
  const lock = useSubmitLock();
  useFormErrors(saveError, form);
  async function refresh() {
    try {
      const data = await request(
        `/stocktakes/${id}/lines?keyword=${encodeURIComponent(line.productCode)}`,
        publicStocktakeLinesSchema,
      );
      const found = data.items.find((r) => r.productCode === line.productCode);
      if (found) setCurrent(found);
      setReloadError('');
    } catch (e) {
      setReloadError(e instanceof Error ? e.message : '刷新失败，请重试');
    }
  }
  async function submit(v: { packages: number; tonnes: number }) {
    try {
      await save({
        id,
        productCode: line.productCode,
        input: {
          expectedRevision: current.revision,
          actual: { packages: v.packages, weightGrams: tonnesDeltaToGrams(v.tonnes) },
        },
      });
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
      title={`实盘录入 · ${line.productName}`}
      size={480}
      onClose={isSaving ? undefined : () => void draft.leave(onClose)}
      keyboard={!isSaving}
      mask={{ closable: false }}
    >
      {current.visibility === 'visible' && (
        <p>
          {businessCopy.stocktakeReadingDrawer1}
          {current.snapshot.packages} 包 / {tonnes(current.snapshot.weightGrams)} 吨
        </p>
      )}
      <p>
        当前已保存：
        {current.actual ? `${current.actual.packages} 包 / ${tonnes(current.actual.weightGrams)} 吨` : '未录入'}
      </p>
      {(saveError || reloadError) && (
        <Alert
          type="error"
          title={reloadError || saveError?.message}
          description="输入保留。数据冲突时先刷新已保存值，核对后再重试。"
          action={<Button onClick={() => void refresh()}>刷新已保存值</Button>}
        />
      )}
      <ProForm<{ packages: number; tonnes: number }>
        form={form}
        onValuesChange={draft.change}
        onFinish={(values) => lock.run(() => submit(values))}
        loading={lock.busy || isSaving}
        disabled={lock.busy || isSaving}
        initialValues={line.actual ? { packages: line.actual.packages, tonnes: line.actual.weightGrams / 1000000 } : {}}
        submitter={{
          submitButtonProps: lock.button,
          resetButtonProps: false,
          searchConfig: { submitText: lock.text('保存实盘') },
        }}
      >
        <ProFormDigit
          name="packages"
          label="实盘包数"
          rules={[{ required: true }]}
          fieldProps={{ min: 0, max: 2147483647, precision: 0, autoFocus: true }}
        />
        <ProFormDigit
          name="tonnes"
          label="实盘总吨数"
          rules={[{ required: true }]}
          fieldProps={{ min: 0, max: 99999999.9999, precision: 4, step: 0.0001 }}
          extra="独立录入实重，不按统一包重换算；零库存必须明确填 0。"
        />
      </ProForm>
    </Drawer>
  );
}
