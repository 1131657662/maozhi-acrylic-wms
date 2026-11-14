import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useFormErrors } from '../../components/use-form-errors';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { Form, Alert, Button, Drawer, Space } from 'antd';
import { ProDescriptions, ProForm } from '@ant-design/pro-components';
import { tonnes, type SourceStockRow, type WebStockRow } from '@wms/contracts';
import { tonnesDeltaToGrams } from '../../lib/weight-input';
import { useSourceStock } from './use-source-stock';
import { useAdjustStock } from './use-adjust-stock';
import { AdjustmentFields, type AdjustmentValues } from './adjustment-fields';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { movementCopy as copy } from './movement-copy';

export function AdjustmentDrawer({ row, onClose }: { row: SourceStockRow | WebStockRow; onClose: () => void }) {
  const [before, setBefore] = useState({ packages: row.packages, weightGrams: row.weightGrams });
  const [reloadError, setReloadError] = useState('');
  const stock = useSourceStock();
  const adjust = useAdjustStock();
  const [form] = Form.useForm();
  const draft = useFormDraft(form, `stock-adjust`, `${row.warehouseCode}:${row.productCode}`);
  const lock = useSubmitLock();
  const confirm = useLockedConfirm();
  useFormErrors(adjust.error, form);
  async function refresh() {
    const result = await stock.refetch();
    const latest = result.data?.items.find(
      (item) => item.warehouseCode === row.warehouseCode && item.productCode === row.productCode,
    );
    if (result.error || !latest) {
      setReloadError('当前库存读取失败，输入已保留，请重试');
      return;
    }
    setBefore({ packages: latest.packages, weightGrams: latest.weightGrams });
    setReloadError('');
  }
  async function submit(values: AdjustmentValues) {
    const packagesDelta = values.packagesDelta;
    const weightDeltaGrams = tonnesDeltaToGrams(values.weightTonnesDelta);
    const after = { packages: before.packages + packagesDelta, weightGrams: before.weightGrams + weightDeltaGrams };
    try {
      const accepted = await confirm.confirm({
        title: copy.confirmation,
        content: (
          <Space orientation="vertical">
            <span>
              {copy.before}：{before.packages} 包 / {tonnes(before.weightGrams)} 吨
            </span>
            <span>
              {copy.after}：{after.packages} 包 / {tonnes(after.weightGrams)} 吨
            </span>
            <span>
              {copy.delta}：{packagesDelta > 0 ? '+' : ''}
              {packagesDelta} 包 / {weightDeltaGrams > 0 ? '+' : ''}
              {tonnes(weightDeltaGrams)} 吨
            </span>
            <span>
              {copy.reason}：{values.reason}
            </span>
          </Space>
        ),
        okText: copy.confirm,
        cancelText: copy.cancel,
        onOk: async () => {
          await adjust.mutateAsync({
            warehouseCode: row.warehouseCode,
            productCode: row.productCode,
            expected: before,
            packagesDelta,
            weightDeltaGrams,
            reason: values.reason,
          });
          draft.saved();
        },
      });
      if (accepted) onClose();
      return false;
    } catch {
      return false;
    }
  }
  return (
    <Drawer
      open
      title="库存调整 · 库存商品"
      size={560}
      onClose={lock.busy || adjust.isPending ? undefined : () => void draft.leave(onClose)}
      closable={{ disabled: adjust.isPending || lock.busy || confirm.busy }}
      mask={{ closable: false }}
      keyboard={!adjust.isPending && !lock.busy && !confirm.busy}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <ProDescriptions
          column={1}
          title={row.productName ?? row.productCode}
          dataSource={row}
          columns={[
            { title: '仓库', dataIndex: 'warehouseCode' },
            { title: '商品编码', dataIndex: 'productCode' },
            { title: '调整前库存', render: () => `${before.packages} 包 / ${tonnes(before.weightGrams)} 吨` },
          ]}
        />
        {adjust.data ? (
          <Alert
            type="success"
            showIcon
            title="库存调整已入账"
            description={
              <>
                <p>
                  {adjust.data.after.packages} 包 / {tonnes(adjust.data.after.weightGrams)} 吨
                </p>
              </>
            }
          />
        ) : (
          <>
            <Alert
              type="warning"
              showIcon
              title="提交将直接调整库存"
              description="这不是修改某一张单据。调整量、前后值和原因将一起写入流水及审计，不能在此撤销。"
            />
            {adjust.error && (
              <RequestError
                type="error"
                showIcon
                error={adjust.error}
                description="已保留输入，可核对后重试；刷新当前库存不会清空原因或调整量。"
                action={
                  <Button onClick={() => void refresh()} loading={stock.isFetching}>
                    刷新当前库存
                  </Button>
                }
              />
            )}
            {reloadError && <Alert type="error" title={reloadError} />}
            <ProForm<AdjustmentValues>
              form={form}
              onValuesChange={draft.change}
              onFinish={(values) => lock.run(() => submit(values))}
              disabled={lock.busy || adjust.isPending || confirm.busy}
              initialValues={{ packagesDelta: 0, weightTonnesDelta: 0 }}
              submitter={{
                submitButtonProps: lock.button,
                searchConfig: { submitText: lock.text('确认调整库存') },
                resetButtonProps: false,
              }}
            >
              <AdjustmentFields before={before} />
            </ProForm>
          </>
        )}
      </Space>
    </Drawer>
  );
}
