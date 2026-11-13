import { Button } from 'antd';
import type { CatalogUploadResult } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { useLockedConfirm } from '../../components/form-protection/use-locked-confirm';
import { useRebuild } from './use-rebuild';
import { candidateCopy as copy } from './candidate-copy';

export function CandidateRebuild({
  versionId,
  onCandidate,
  primary = false,
}: {
  versionId: number;
  onCandidate: (result: CatalogUploadResult) => void;
  primary?: boolean;
}) {
  const { mutateAsync: rebuild, isPending: rebuilding, error: rebuildError } = useRebuild(versionId);
  const modal = useLockedConfirm();
  const confirm = () =>
    modal.confirm({
      title: copy.confirmRebuild,
      content: copy.rebuildHint,
      okText: copy.confirmRebuild,
      cancelText: copy.cancel,
      onOk: async () => {
        onCandidate(await rebuild());
      },
    });
  return (
    <>
      <Button type={primary ? 'primary' : 'default'} onClick={confirm} loading={rebuilding} disabled={modal.busy}>
        {copy.rebuild}
      </Button>
      {rebuildError && <RequestError type="error" error={rebuildError} />}
    </>
  );
}
