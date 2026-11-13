import { businessCopy } from '../../business-copy';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Result, Skeleton, Space } from 'antd';
import { DatabaseOutlined, ReloadOutlined } from '@ant-design/icons';
import type { CatalogUploadResult } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { catalogKeys } from './keys';
import { CatalogOverview } from './overview';
import { CatalogUpload } from './upload';
import { CatalogCandidate } from './candidate';
import { VersionHistory } from './version-history';
import { HandoffPanel } from './handoff-panel';
import { CatalogDirectorySearch } from './directory-search';
import { CatalogSpecSummary } from './spec-summary';
import { CatalogLookup } from './lookup';
import { Card as DesignCard, PageShell, SectionTitle, Toolbar } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';

export function CatalogPage() {
  const [candidate, setCandidate] = useState<CatalogUploadResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: overview, error, isLoading, refetch } = useQuery(catalogKeys.overview);
  if (error instanceof ApiError && error.status === 403)
    return (
      <PageShell title="条码目录" icon={<DatabaseOutlined />} description="全量上传 · 差异核对 · 整版发布">
        <Result status="403" title="请在网页端登录后管理条码目录" />
      </PageShell>
    );
  return (
    <PageShell
      title="条码目录"
      icon={<DatabaseOutlined />}
      description="全量上传 · 差异核对 · 整版发布"
      actions={
        <Toolbar>
          <Button aria-label="刷新状态" icon={<ReloadOutlined />} onClick={() => void refetch()}>
            刷新状态
          </Button>
        </Toolbar>
      }
    >
      <Space orientation="vertical" size={spacing[16]} style={{ width: '100%', maxWidth: 1440 }}>
        {isLoading && <Skeleton active />}
        {error && (
          <RequestError
            type="error"
            error={error}
            action={<Button onClick={() => void refetch()}>重试目录状态</Button>}
          />
        )}
        {overview && <CatalogOverview overview={overview} />}
        {overview && (
          <Space
            orientation="vertical"
            size={spacing[16]}
            style={{ width: '100%' }}
            data-testid="catalog-section-query"
          >
            <CatalogDirectorySearch />
            <CatalogSpecSummary />
            <CatalogLookup />
          </Space>
        )}
        {overview && (
          <section data-testid="catalog-section-upload">
            <Space orientation="vertical" size={spacing[8]} style={{ width: '100%' }}>
              <SectionTitle title={businessCopy.catalogSectionUpload} />
              <Space orientation="vertical" size={spacing[16]} style={{ width: '100%' }}>
                {candidate?.version && (
                  <CatalogCandidate
                    key={candidate.uploadId}
                    upload={candidate}
                    allowed={!!overview.gate.allowed && !error}
                  />
                )}
                <DesignCard title={candidate?.version ? businessCopy.catalogPage1 : '上传全部条码'}>
                  <CatalogUpload
                    hasCandidate={!!candidate?.version && candidate.version.versionId !== overview.current?.versionId}
                    onCandidate={(result) => setCandidate(result.version ? result : null)}
                  />
                </DesignCard>
              </Space>
            </Space>
          </section>
        )}
        {overview && (
          <VersionHistory
            open={historyOpen}
            onOpen={() => setHistoryOpen(true)}
            onClose={() => setHistoryOpen(false)}
            currentVersionId={overview.current?.versionId}
            onSelect={(version) =>
              setCandidate({
                uploadId: version.uploadId,
                duplicate: false,
                matchedVersionId: null,
                message: '',
                version,
              })
            }
          />
        )}
        {overview && <HandoffPanel />}
      </Space>
    </PageShell>
  );
}
