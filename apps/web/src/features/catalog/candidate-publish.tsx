import { Alert, Button } from 'antd';
import type { CatalogVersion } from '@wms/contracts';
import { businessCopy } from '../../business-copy';
import { RequestError } from '../../components/RequestError';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { formCopy } from '../../components/form-protection/copy';
import { usePublish } from './use-publish';
import { candidateCopy as copy } from './candidate-copy';

export function CandidatePublish({ version, allowed }: { version: CatalogVersion; allowed: boolean }) {
  const modal = useLockedConfirm();
  const { mutateAsync: publish, isPending: publishing, error: publishError } = usePublish(version.uploadId);
  if (version.status === 'published') return <Alert type="success" showIcon title={copy.published} />;
  const confirm = () =>
    modal.confirm({
      title: copy.publishTitle(version.versionId),
      content: `${copy.publishHint(version.entryCount)}${version.entryCount === 0 ? businessCopy.catalogCandidate1 : ''}`,
      okText: copy.confirmPublish,
      cancelText: copy.cancel,
      onOk: () => publish(version),
    });
  return (
    <>
      {publishError && <RequestError type="error" showIcon error={publishError} />}
      <Button
        type={version.status === 'abandoned' ? 'default' : 'primary'}
        loading={publishing}
        disabled={!allowed || modal.busy || version.status === 'abandoned'}
        onClick={confirm}
      >
        {modal.busy ? formCopy.submitting : copy.publish}
      </Button>
    </>
  );
}
