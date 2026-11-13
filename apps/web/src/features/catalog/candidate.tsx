import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Space } from 'antd';
import { listTime, type CatalogUploadResult, type CatalogVersion } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { Card, SectionTitle, StatusTag } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
import { DiffPreview } from './diff-preview';
import { catalogKeys } from './keys';
import { catalogStatusPresentation } from './query-display';
import { CandidateAbandon } from './candidate-abandon';
import { CandidateRebuild } from './candidate-rebuild';
import { CandidateEvidence } from './candidate-evidence';
import { CandidatePublish } from './candidate-publish';
import { candidateCopy as copy } from './candidate-copy';

export function CatalogCandidate({
  upload,
  allowed,
  onCandidate,
}: {
  upload: CatalogUploadResult;
  allowed: boolean;
  onCandidate: (result: CatalogUploadResult) => void;
}) {
  const { data: current, error: detailError, refetch } = useQuery(catalogKeys.version(upload.version!.versionId));
  const version = current ?? upload.version!;
  const status = catalogStatusPresentation(version.status);
  return (
    <Space orientation="vertical" size={spacing[16]} style={{ width: '100%' }}>
      <Card
        title={<SectionTitle title={copy.candidateTitle(version.versionId, status.label)} />}
        extra={<StatusTag status={status.label} type={status.tone} />}
        testId="catalog-candidate"
      >
        <Space orientation="vertical" size={spacing[16]} style={{ width: '100%' }}>
          <CandidateSummary version={version} />
          {detailError && (
            <RequestError
              type="error"
              error={detailError}
              action={<Button onClick={() => void refetch()}>{copy.retry}</Button>}
            />
          )}
          <CandidatePublish version={version} allowed={allowed && !detailError && !!current} />
          <CandidateActions version={version} onCandidate={onCandidate} />
          <DiffPreview key={version.versionId} version={version} />
        </Space>
      </Card>
      <CandidateEvidence key={version.versionId} versionId={version.versionId} />
    </Space>
  );
}
function CandidateActions({
  version,
  onCandidate,
}: {
  version: CatalogVersion;
  onCandidate: (result: CatalogUploadResult) => void;
}) {
  if (version.status === 'published') return null;
  return (
    <Space orientation="vertical" size={spacing[16]}>
      <CandidateRebuild
        versionId={version.versionId}
        onCandidate={onCandidate}
        primary={version.status === 'abandoned'}
      />
      {version.status === 'validated' && (
        <div>
          <CandidateAbandon versionId={version.versionId} />
        </div>
      )}
    </Space>
  );
}
function CandidateSummary({ version }: { version: CatalogVersion }) {
  return (
    <>
      <Space wrap>
        <strong>{copy.added(version.diffCounts.added)}</strong>
        <strong>{copy.removed(version.diffCounts.removed)}</strong>
        <strong>{copy.weightChanged(version.diffCounts.weight)}</strong>
        <span>{copy.specChanged(version.diffCounts.spec)}</span>
      </Space>
      <Alert type="info" title={copy.historyTitle} description={copy.historyHint} />
      {version.abandonment && <AbandonmentEvidence evidence={version.abandonment} />}
    </>
  );
}
function AbandonmentEvidence({ evidence }: { evidence: NonNullable<CatalogVersion['abandonment']> }) {
  return (
    <Alert
      type="warning"
      title={copy.abandoned}
      description={
        <>
          <div>
            {copy.reason}：{evidence.reason}
          </div>
          <div>
            {copy.time}：{listTime(evidence.createdAt)}
          </div>
          <div>
            {copy.actor}：{evidence.actor}
          </div>
        </>
      }
    />
  );
}
