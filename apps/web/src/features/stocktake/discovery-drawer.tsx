import { useState } from 'react';
import { Alert, Button, Drawer, Form } from 'antd';
import { ProForm, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import {
  discoveryCopy as t,
  DISCOVERY_MAX_PACKAGES,
  DISCOVERY_MAX_TONNES,
  DISCOVERY_REASON_LIMIT,
  publicStocktakeLinesSchema,
  tonnes,
  type PublicStocktakeLine,
} from '@wms/contracts';
import { MasterSelect } from '../master-data/select';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { useFormErrors } from '../../components/use-form-errors';
import { tonnesDeltaToGrams } from '../../lib/weight-input';
import { request } from '../../api/client';
import { useDiscovery } from './use-discovery';

interface Values {
  productCode: string;
  packages: number;
  tonnes: number;
  reason: string;
}
export function DiscoveryDrawer({
  id,
  line,
  onClose,
}: {
  id: string;
  line?: PublicStocktakeLine;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(line),
    [reloadError, setReloadError] = useState('');
  const mutation = useDiscovery(id),
    lock = useSubmitLock();
  const [form] = Form.useForm<Values>();
  const draft = useFormDraft(form, 'stocktake-discovery', `${id}:${line?.discovery?.id ?? 'new'}`);
  useFormErrors(mutation.error, form);
  async function refresh() {
    try {
      const result = await request(
        `/stocktakes/${id}/lines?keyword=${encodeURIComponent(line?.productCode ?? '')}`,
        publicStocktakeLinesSchema,
      );
      const found = result.items.find((item) => item.discovery?.id === line?.discovery?.id);
      if (!found) throw new Error(t.missing);
      setCurrent(found);
      setReloadError('');
    } catch (error) {
      setReloadError(error instanceof Error ? error.message : t.retry);
    }
  }
  async function submit(values: Values) {
    try {
      const input = {
        packages: values.packages,
        weightGrams: tonnesDeltaToGrams(values.tonnes),
        reason: values.reason.trim(),
      };
      await mutation.mutateAsync(
        current?.discovery
          ? { method: 'PATCH', lineId: current.discovery.id, input: { ...input, version: current.discovery.version } }
          : { method: 'POST', input: { ...input, productCode: values.productCode } },
      );
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
      title={line ? t.edit : t.register}
      size={480}
      mask={{ closable: false }}
      keyboard={!mutation.isPending}
      onClose={mutation.isPending ? undefined : () => void draft.leave(onClose)}
    >
      {current && (
        <p>
          {current.productName} · {current.productCode}
          <br />
          {t.packages} / {t.tonnes}：{current.actual?.packages} / {tonnes(current.actual?.weightGrams ?? 0)}
          <br />
          {t.reason}：{current.discovery?.reason}
        </p>
      )}
      {(mutation.error || reloadError) && (
        <Alert
          type="error"
          title={reloadError || mutation.error?.message}
          description={t.retry}
          action={line && <Button onClick={() => void refresh()}>{t.refresh}</Button>}
        />
      )}
      <ProForm<Values>
        form={form}
        onValuesChange={draft.change}
        onFinish={(values) => lock.run(() => submit(values))}
        loading={lock.busy || mutation.isPending}
        disabled={lock.busy || mutation.isPending}
        initialValues={
          line?.actual
            ? {
                productCode: line.productCode,
                packages: line.actual.packages,
                tonnes: line.actual.weightGrams / 1000000,
                reason: line.discovery?.reason,
              }
            : {}
        }
        submitter={{
          submitButtonProps: lock.button,
          resetButtonProps: false,
          searchConfig: { submitText: lock.text(t.save) },
        }}
      >
        {!line && (
          <ProForm.Item name="productCode" label={t.product} rules={[{ required: true }]}>
            <MasterSelect catalog="products" />
          </ProForm.Item>
        )}
        <ProFormDigit
          name="packages"
          label={t.packages}
          rules={[{ required: true }]}
          fieldProps={{ min: 0, max: DISCOVERY_MAX_PACKAGES, precision: 0 }}
        />
        <ProFormDigit
          name="tonnes"
          label={t.tonnes}
          rules={[{ required: true }]}
          extra={t.independentWeight}
          fieldProps={{ min: 0, max: DISCOVERY_MAX_TONNES, precision: 4, step: 0.0001 }}
        />
        <ProFormTextArea
          name="reason"
          label={t.reason}
          rules={[{ required: true, whitespace: true }]}
          fieldProps={{ maxLength: DISCOVERY_REASON_LIMIT, rows: 3 }}
        />
      </ProForm>
    </Drawer>
  );
}
