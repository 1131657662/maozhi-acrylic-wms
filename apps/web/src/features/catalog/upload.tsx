import { businessCopy } from '../../business-copy';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { Alert, Button, Space, Upload } from 'antd';
import { ProForm, ProFormSelect } from '@ant-design/pro-components';
import type { CatalogUploadResult } from '@wms/contracts';
import { useUpload } from './use-upload';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';

export function CatalogUpload({
  onCandidate,
  hasCandidate,
}: {
  onCandidate: (result: CatalogUploadResult) => void;
  hasCandidate: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState('gb18030');
  const { mutateAsync: upload, data: result, error, reset } = useUpload();
  const lock = useSubmitLock();
  const run = (rebuildOfVersionId?: number) =>
    lock.run(async () => {
      if (file) return upload({ file, encoding, rebuildOfVersionId }, { onSuccess: onCandidate });
    });
  return (
    <ProForm submitter={false} layout="vertical" initialValues={{ encoding: 'gb18030' }}>
      <SnapshotFields
        file={file}
        encoding={encoding}
        pending={lock.busy}
        onFile={(value) => {
          setFile(value);
          reset();
        }}
        onEncoding={(value) => {
          setEncoding(value);
          reset();
        }}
      />
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {error && <RequestError type="error" showIcon error={error} description={businessCopy.catalogUpload1} />}
        {result?.duplicate && <DuplicateNotice result={result} pending={lock.busy} onRebuild={run} />}
        <Button
          type={hasCandidate ? 'default' : 'primary'}
          loading={lock.busy}
          disabled={!file || lock.busy}
          onClick={() => {
            void run().catch(() => undefined);
          }}
        >
          {lock.text(businessCopy.catalogUpload3)}
        </Button>
      </Space>
    </ProForm>
  );
}

interface SnapshotFieldsProps {
  file: File | null;
  encoding: string;
  pending: boolean;
  onFile: (file: File | null) => void;
  onEncoding: (encoding: string) => void;
}
function SnapshotFields({ file, encoding, pending, onFile, onEncoding }: SnapshotFieldsProps) {
  return (
    <>
      <ProForm.Item label="全量条码文件（txt）" htmlFor="catalog-snapshot" required extra={businessCopy.catalogUpload4}>
        <Upload
          id="catalog-snapshot"
          accept=".txt"
          maxCount={1}
          disabled={pending}
          beforeUpload={() => false}
          onChange={({ fileList }) => onFile(fileList[0]?.originFileObj ?? null)}
          fileList={file ? [{ uid: 'selected', name: file.name, status: 'done' }] : []}
        >
          <Button disabled={pending}>选择全量文件</Button>
        </Upload>
      </ProForm.Item>
      <ProFormSelect
        name="encoding"
        label="文件编码"
        width="sm"
        fieldProps={{ value: encoding, onChange: (value) => onEncoding(String(value)), disabled: pending }}
        options={[
          { label: 'UTF-8', value: 'utf-8' },
          { label: 'GB18030', value: 'gb18030' },
        ]}
      />
    </>
  );
}

function DuplicateNotice({
  result,
  pending,
  onRebuild,
}: {
  result: CatalogUploadResult;
  pending: boolean;
  onRebuild: (id?: number) => Promise<unknown>;
}) {
  const modal = useLockedConfirm();
  const rebuild = () =>
    modal.confirm({
      title: '确认重建相同内容的版本？',
      content: `内容与第 ${result.matchedVersionId} 版相同。重建会保留一条新的版本历史，仍需另行发布。`,
      okText: '确认重建版本',
      cancelText: '不重建',
      onOk: () => onRebuild(result.matchedVersionId ?? undefined),
    });
  return (
    <Alert
      type="info"
      showIcon
      title={result.message}
      description="未创建新版本，当前目录未变。只有确需保留新版本历史时才重建。"
      action={
        <Button onClick={rebuild} disabled={pending}>
          仍需重建
        </Button>
      }
    />
  );
}
