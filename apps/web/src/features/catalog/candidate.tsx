import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { formCopy } from '../../components/form-protection/copy';
import { businessCopy } from '../../business-copy';
import { RequestError } from '../../components/RequestError';
import { Alert, Button, Space } from 'antd';
import type { CatalogUploadResult } from '@wms/contracts';
import { DiffPreview } from './diff-preview';
import { usePublish } from './use-publish';
import { Card, SectionTitle, StatusTag } from '../../components/ui';

export function CatalogCandidate({ upload, allowed }: { upload: CatalogUploadResult; allowed: boolean }) {
  const version = upload.version!;
  const modal = useLockedConfirm();
  const { mutateAsync: publish, isPending, isSuccess, error } = usePublish(upload.uploadId);
  const published = isSuccess || version.status === 'published';
  const confirm = () =>
    modal.confirm({
      title: `发布第 ${version.versionId} 版完整目录？`,
      content: `发布后当前目录为 ${version.entryCount} 条。消失条码不需失效确认；已有扫码记录仍保留原重量和版本。${version.entryCount === 0 ? businessCopy.catalogCandidate1 : ''}`,
      okText: '确认发布整版',
      cancelText: '返回核对',
      onOk: () => publish(version),
    });
  return (
    <Card
      title={
        <SectionTitle title={published ? `第 ${version.versionId} 版已发布` : `第 ${version.versionId} 版待发布`} />
      }
      extra={
        <StatusTag
          status={published ? '历史记录保留' : '当前目录尚未改变'}
          type={published ? 'success' : 'processing'}
        />
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <strong>新增 {version.diffCounts.added} 条</strong>
          <strong>消失 {version.diffCounts.removed} 条</strong>
          <strong>重量变更 {version.diffCounts.weight} 条</strong>
          <span>规格变更 {version.diffCounts.spec} 条</span>
        </Space>
        <Alert
          type="info"
          title="消失不等于删除历史"
          description="仅影响刷新到新版后的新扫码；已有扫码记录仍可查看和核对，出库数量以网页填写并确认为准。重量变化不会改动已有记录。"
        />
        {error && <RequestError type="error" showIcon error={error} />}
        {published ? (
          <Alert type="success" showIcon title="整版发布成功，已有扫码记录未改变" />
        ) : (
          <Button type="primary" loading={isPending} disabled={!allowed || modal.busy} onClick={confirm}>
            {modal.busy ? formCopy.submitting : '发布整版'}
          </Button>
        )}
        <DiffPreview key={version.versionId} version={version} />
      </Space>
    </Card>
  );
}
