import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Drawer, Empty, Pagination, Skeleton, Space, Tag } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import type { CatalogVersion } from '@wms/contracts';
import { catalogKeys } from './keys';

export function VersionHistory({
  open,
  onClose,
  currentVersionId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  currentVersionId?: number;
  onSelect: (version: CatalogVersion) => void;
}) {
  const [page, setPage] = useState(1);
  const { data: history, error, isLoading, refetch } = useQuery({ ...catalogKeys.history(page), enabled: open });
  return (
    <Drawer title="目录版本历史" open={open} onClose={onClose} size="min(720px,100%)">
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          title="历史版长期保留"
          description="发布纠正版请重新上传完整文件。不能删除旧版本或直接退回 v1；历史事实须继续追溯。"
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
            {version.versionId === currentVersionId && <Tag color="blue">当前活动版本</Tag>}
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
        {history?.items.length === 0 && <Empty description="暂无目录版本记录" />}
        <Pagination
          current={page}
          pageSize={20}
          total={history?.total ?? 0}
          onChange={setPage}
          showSizeChanger={false}
        />
      </Space>
    </Drawer>
  );
}
function VersionRecord({ version }: { version: CatalogVersion }) {
  return (
    <Card
      size="small"
      title={`第 ${version.versionId} 版`}
      extra={
        <Tag color={version.status === 'published' ? 'green' : 'default'}>
          {version.status === 'published' ? '已发布' : '待发布'}
        </Tag>
      }
    >
      <ProDescriptions
        column={1}
        size="small"
        dataSource={version}
        columns={[
          { title: '文件', dataIndex: 'sourceName' },
          { title: '条码 / 规格', render: () => `${version.entryCount} 条 / ${version.specCount} 种` },
          { title: '校验时间', dataIndex: 'createdAt' },
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
