import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { Alert, App, Button, Space, Upload } from 'antd';
import { ProForm, ProFormSelect } from '@ant-design/pro-components';
import type { CatalogUploadResult } from '@wms/contracts';
import { useUpload } from './use-upload';

export function CatalogUpload({
  onCandidate,
  hasCandidate,
}: {
  onCandidate: (result: CatalogUploadResult) => void;
  hasCandidate: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState('gb18030');
  const { mutate: upload, data: result, error, isPending, reset } = useUpload();
  const run = (rebuildOfVersionId?: number) =>
    file && upload({ file, encoding, rebuildOfVersionId }, { onSuccess: onCandidate });
  return (
    <ProForm submitter={false} layout="vertical" initialValues={{ encoding: 'gb18030' }}>
      <SnapshotFields
        file={file}
        encoding={encoding}
        pending={isPending}
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
        {error && (
          <RequestError
            type="error"
            showIcon
            error={error}
            description="文件未丢失。核对编码或更换文件后可再次校验。"
          />
        )}
        {result?.duplicate && <DuplicateNotice result={result} pending={isPending} onRebuild={run} />}
        <Button
          type={hasCandidate ? 'default' : 'primary'}
          loading={isPending}
          disabled={!file}
          onClick={() => {
            run();
          }}
        >
          {isPending ? '校验中，当前版本仍可用' : '上传并校验'}
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
      <ProForm.Item
        label="全量条码文件（txt）"
        htmlFor="catalog-snapshot"
        required
        extra="每行：规格描述、条码、重量 kg；支持 UTF-8 / GB18030，最大 5 MiB。空文件代表零条快照，发布前需确认。"
      >
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
  onRebuild: (id?: number) => void;
}) {
  const { modal } = App.useApp();
  const rebuild = () =>
    modal.confirm({
      title: '确认重建相同内容的版本？',
      content: `内容与第 ${result.matchedVersionId} 版相同。重建会保留一条新的版本历史，仍需另行发布。`,
      okText: '确认重建版本',
      cancelText: '不重建',
      onOk: () => {
        onRebuild(result.matchedVersionId ?? undefined);
      },
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
