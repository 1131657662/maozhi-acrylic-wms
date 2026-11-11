import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useFormErrors } from '../../components/use-form-errors';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { businessCopy } from '../../business-copy';
import { useState } from 'react';
import { Form, Alert, Button, Checkbox, Drawer, Space } from 'antd';
import { ProForm, ProFormTextArea } from '@ant-design/pro-components';
import { stocktakePreviewSchema, tonnes, type StocktakePreview } from '@wms/contracts';
import { request } from '../../api/client';
import { usePostStocktake } from './use-post-stocktake';
import { UnpostedTable } from './unposted-table';

export function StocktakePostDrawer({ initial, onClose }: { initial: StocktakePreview; onClose: () => void }) {
  const [preview, setPreview] = useState(initial),
    [ackToken, setAckToken] = useState(''),
    [refreshError, setRefreshError] = useState('');
  const { mutateAsync: post, isPending: isPosting, error: postError } = usePostStocktake();
  const [form] = Form.useForm();
  const draft = useFormDraft(form, `stocktake-post`, initial.stocktake.id);
  const lock = useSubmitLock();
  useFormErrors(postError, form);
  const acknowledged = ackToken === preview.token,
    take = preview.stocktake;
  async function refresh() {
    try {
      setPreview(await request(`/stocktakes/${take.id}/preview`, stocktakePreviewSchema));
      setRefreshError('');
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : '刷新失败');
    }
  }
  async function submit(v: { reason: string }) {
    try {
      await post({
        id: take.id,
        input: { reason: v.reason.trim(), expectedToken: preview.token, acknowledgeSnapshotBasis: acknowledged },
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
      title={`人工核对回写 · ${take.number}`}
      size={960}
      maxSize={1100}
      mask={{ closable: false }}
      keyboard={!isPosting}
      onClose={isPosting ? undefined : () => void draft.leave(onClose)}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title={`差异 ${take.changedCount} 行：${take.packagesDelta} 包 / ${tonnes(take.weightDeltaGrams)} 吨`}
          description={`已录 ${take.recordedCount}/${take.lineCount} 行。差异始终按盘点开始时库存计算；包数与吨数分别核对。零差异也需人工完成，不写零变化流水。`}
        />
        {preview.blockers.map((b) => (
          <Alert key={b.code} type="error" title={b.message} />
        ))}
        <UnpostedTable rows={preview.unposted} />
        {preview.unposted.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title="存在未入账收发货，默认禁止回写"
            description={businessCopy.stocktakePostDrawer1}
          />
        )}
        {preview.unposted.length > 0 && (
          <Checkbox
            checked={acknowledged}
            disabled={lock.busy || isPosting}
            onChange={(e) => setAckToken(e.target.checked ? preview.token : '')}
          >
            {businessCopy.stocktakePostDrawer2}
          </Checkbox>
        )}
        {(postError || refreshError) && (
          <Alert
            type="error"
            title={refreshError || postError?.message}
            description="原因与输入保留；网络失败可原键重试。清单或实盘变化须刷新预览，重新核对并勾选。"
          />
        )}
        <Button onClick={() => void refresh()} disabled={lock.busy || isPosting}>
          刷新回写预览
        </Button>
        <ProForm<{ reason: string }>
          form={form}
          onValuesChange={draft.change}
          onFinish={(values) => lock.run(() => submit(values))}
          loading={lock.busy || isPosting}
          disabled={lock.busy || isPosting}
          submitter={false}
        >
          <ProFormTextArea
            name="reason"
            label="回写原因"
            rules={[{ required: true, whitespace: true, message: '请填写回写原因' }]}
            fieldProps={{ maxLength: 500, rows: 3 }}
          />
          <Button
            type="primary"
            htmlType="submit"
            aria-label="人工确认并回写库存"
            aria-busy={isPosting}
            loading={lock.busy || isPosting}
            disabled={lock.busy || preview.blockers.length > 0 || (preview.unposted.length > 0 && !acknowledged)}
          >
            {lock.text('人工确认并回写库存')}
          </Button>
        </ProForm>
      </Space>
    </Drawer>
  );
}
