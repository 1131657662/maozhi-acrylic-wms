import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Result, Skeleton, Space } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import type { CatalogUploadResult } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { catalogKeys } from './keys';
import { CatalogOverview } from './overview';
import { CatalogUpload } from './upload';
import { CatalogCandidate } from './candidate';
import { VersionHistory } from './version-history';
import { HandoffPanel } from './handoff-panel';

export function CatalogPage() {
  const [candidate, setCandidate] = useState<CatalogUploadResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: overview, error, isLoading, refetch } = useQuery(catalogKeys.overview);
  if (error instanceof ApiError && error.status === 403)
    return <Result status="403" title="仅 Web 登录用户可管理条码目录" />;
  return (
    <PageContainer
      title="条码目录"
      subTitle="全量上传 · 差异核对 · 整版发布"
      extra={[
        <Button key="history" onClick={() => setHistoryOpen(true)}>
          版本历史
        </Button>,
        <Button key="refresh" onClick={() => void refetch()}>
          刷新状态
        </Button>,
      ]}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%', maxWidth: 1440 }}>
        {isLoading && <Skeleton active />}
        {error && (
          <RequestError
            type="error"
            error={error}
            action={<Button onClick={() => void refetch()}>重试目录状态</Button>}
          />
        )}
        {overview && <CatalogOverview overview={overview} />}
        {overview && <HandoffPanel />}
        {candidate?.version && (
          <CatalogCandidate key={candidate.uploadId} upload={candidate} allowed={!!overview?.gate.allowed && !error} />
        )}
        {overview && (
          <Card title={candidate?.version ? '更换 / 上传下一份全量快照' : '上传全量快照'}>
            <CatalogUpload
              hasCandidate={!!candidate?.version && candidate.version.versionId !== overview.current?.versionId}
              onCandidate={(result) => setCandidate(result.version ? result : null)}
            />
          </Card>
        )}
      </Space>
      <VersionHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentVersionId={overview?.current?.versionId}
        onSelect={(version) =>
          setCandidate({ uploadId: version.uploadId, duplicate: false, matchedVersionId: null, message: '', version })
        }
      />
    </PageContainer>
  );
}
