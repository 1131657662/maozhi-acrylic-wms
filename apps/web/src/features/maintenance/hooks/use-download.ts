import { useMutation } from '@tanstack/react-query';
import { maintenanceMutations } from '../queries/maintenance-keys';
import { downloadBackup } from '../download';

export function useDownload() {
  return useMutation({
    ...maintenanceMutations.download,
    mutationFn: downloadBackup,
    meta: { skipWorkbenchRefresh: true },
  });
}
