import { useState } from 'react';
import { Alert, Button, Drawer, Space } from 'antd';
import { ProForm, ProFormTextArea } from '@ant-design/pro-components';
import { lifecyclePreviewSchema, type LifecyclePreview } from '@wms/contracts';
import { request } from '../../api/client';
import { CompensationPreview } from './preview';
import { useCloseDocument } from './use-close-document';

export function LifecycleDrawer({ initial, onClose }: { initial: LifecyclePreview; onClose: () => void }) {
  const [preview, setPreview] = useState(initial),
    [refreshError, setRefreshError] = useState('');
  const { mutateAsync: closeDocument, isPending: isClosing, error: closeError } = useCloseDocument();
  async function refresh() {
    try {
      setPreview(await request(`/${initial.kind}/${initial.id}/lifecycle`, lifecyclePreviewSchema));
      setRefreshError('');
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : '预览刷新失败，请重试');
    }
  }
  async function submit(values: { reason: string }) {
    try {
      await closeDocument({ preview, reason: values.reason });
      onClose();
      return true;
    } catch {
      return false;
    }
  }
  return (
    <Drawer
      open
      title={`${initial.action === 'reverse' ? '撤销误确认' : '作废未入账单据'} · ${initial.number}`}
      size={560}
      onClose={isClosing ? undefined : onClose}
      mask={{ closable: false }}
      keyboard={!isClosing}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <CompensationPreview preview={preview} />
        {(closeError || refreshError) && (
          <Alert
            type="error"
            showIcon
            title={refreshError || closeError?.message}
            description="原因与原请求已保留。网络失败可重试；数据变化时请刷新预览，核对后再提交。"
            action={
              <Button disabled={isClosing} onClick={() => void refresh()}>
                刷新预览
              </Button>
            }
          />
        )}
        <ProForm<{ reason: string }>
          onFinish={submit}
          disabled={isClosing}
          submitter={{
            resetButtonProps: false,
            searchConfig: { submitText: initial.action === 'reverse' ? '确认撤销入账' : '确认作废' },
            submitButtonProps: { danger: true, disabled: !preview.allowed || preview.action !== initial.action },
          }}
        >
          <ProFormTextArea
            name="reason"
            label={initial.action === 'reverse' ? '误确认原因' : '作废原因'}
            rules={[{ required: true, whitespace: true, message: '请填写原因，便于事后核对' }, { max: 500 }]}
            fieldProps={{ maxLength: 500, showCount: true, autoSize: { minRows: 3, maxRows: 6 } }}
          />
        </ProForm>
      </Space>
    </Drawer>
  );
}
