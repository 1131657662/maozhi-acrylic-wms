import { businessCopy } from '../../business-copy';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Pagination, Skeleton, Space } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { ProDescriptions } from '@ant-design/pro-components';
import type { CatalogVersion } from '@wms/contracts';
import { catalogKeys } from './keys';
import { Card, EmptyState, SectionTitle, StatusTag, Toolbar } from '../../components/ui';

export function VersionHistory({
  open,
  onOpen,
  onClose,
  currentVersionId,
  onSelect,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  currentVersionId?: number;
  onSelect: (version: CatalogVersion) => void;
}) {
  const [page, setPage] = useState(1);
  const { data: history, error, isLoading, refetch } = useQuery({ ...catalogKeys.history(page), enabled: open });
  return (
    <section data-testid="catalog-section-history">
      <Card
        title={<SectionTitle title={businessCopy.catalogSectionVersions} />}
        extra={
          <Toolbar>
            <Button aria-label="版本历史" icon={<HistoryOutlined />} onClick={onOpen}>
              版本历史
            </Button>
          </Toolbar>
        }
      >
        {currentVersionId ? (
          <StatusTag status={`当前活动版本 · 第 ${currentVersionId} 版`} type="processing" />
        ) : (
          <EmptyState description="暂无当前目录版本" />
        )}
      </Card>
      <Drawer title="目录版本历史" open={open} onClose={onClose} size="min(720px,100%)">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            title="历史版长期保留"
            description="发布纠正版请重新上传完整文件。不能删除旧版本或直接退回 v1；历史扫码记录须继续追溯。"
          />
          {isLoading && <Skeleton active />}
          {error && (
            <RequestError
              type="error"
              error={error}
              action={<Button onClick={() => void refetch()}>重试版本历史</Button>}
            />
          )}
          {history?.items.map((version) => (
            <div key={version.versionId}>
              <VersionRecord version={version} />
              {version.versionId === currentVersionId && <StatusTag status="当前活动版本" type="processing" />}
              {version.status === 'validated' && (
                <Button
                  onClick={() => {
                    onSelect(version);
                    onClose();
                  }}
                >
                  继续核对第 {version.versionId} 版
                </Button>
              )}
            </div>
          ))}
          {history?.items.length === 0 && <EmptyState description="暂无目录版本记录" />}
          <Pagination
            current={page}
            pageSize={20}
            total={history?.total ?? 0}
            onChange={setPage}
            showSizeChanger={false}
          />
        </Space>
      </Drawer>
    </section>
  );
}
function VersionRecord({ version }: { version: CatalogVersion }) {
  return (
    <Card
      padding="compact"
      title={<SectionTitle title={`第 ${version.versionId} 版`} />}
      extra={
        <StatusTag
          status={version.status === 'published' ? '已发布' : '待发布'}
          type={version.status === 'published' ? 'success' : 'default'}
        />
      }
    >
      <ProDescriptions
        column={1}
        size="small"
        dataSource={version}
        columns={[
          { title: '文件', dataIndex: 'sourceName' },
          { title: '条码 / 规格', render: () => `${version.entryCount} 条 / ${version.specCount} 种` },
          { title: businessCopy.catalogVersionHistory1, dataIndex: 'createdAt' },
          { title: '发布时间', render: () => version.publishedAt ?? '尚未发布' },
          {
            title: '内容 SHA-256',
            render: () => <span style={{ overflowWrap: 'anywhere' }}>{version.contentSha256}</span>,
          },
        ]}
      />
    </Card>
  );
}
