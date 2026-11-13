import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Pagination, Skeleton, Space } from 'antd';
import { Card, EmptyState, SectionTitle, StatusTag } from '../../components/ui';
import { RequestError } from '../../components/RequestError';
import { spacing } from '../../theme/design-tokens';
import { catalogKeys } from './keys';
import { candidateCopy as copy } from './candidate-copy';
import { listTime } from '@wms/contracts';

export function CandidateEvidence({ versionId }: { versionId: number }) {
  const [page, setPage] = useState(1);
  const {
    data: evidence,
    error: evidenceError,
    isLoading: loading,
    refetch,
  } = useQuery(catalogKeys.handoffs(versionId, page));
  return (
    <Card title={<SectionTitle title={copy.evidence} />} testId="candidate-handoff-evidence">
      <Space orientation="vertical" size={spacing[16]} style={{ width: '100%' }}>
        <Alert type="info" title={copy.evidenceHint} />
        {loading && <Skeleton active />}
        {evidenceError && (
          <RequestError
            type="error"
            error={evidenceError}
            action={<Button onClick={() => void refetch()}>{copy.retryEvidence}</Button>}
          />
        )}
        {evidence?.items.map((item, index) => (
          <div key={`${page}-${index}`}>
            <div>
              {copy.registeredAt}：{listTime(item.createdAt)}
            </div>
            <div>
              {copy.expected}：{item.expectedCount} · {copy.registered}：{item.registered} · {copy.received}：
              {item.received} · {copy.unresolved}：{item.unresolved}
            </div>
            <StatusTag
              status={item.confirmedAt ? copy.confirmed : copy.unconfirmed}
              type={item.confirmedAt ? 'success' : 'warning'}
            />
          </div>
        ))}
        {evidence?.total === 0 && <EmptyState description={copy.noEvidence} />}
        {evidence && evidence.total > evidence.pageSize && (
          <Pagination
            current={page}
            total={evidence.total}
            pageSize={evidence.pageSize}
            showSizeChanger={false}
            onChange={setPage}
          />
        )}
      </Space>
    </Card>
  );
}
