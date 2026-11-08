import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ExportRequest } from '@wms/contracts';
import { useStartExport } from './use-start-export';
import { useExportJob } from './use-export-job';
import { exportKeys } from './keys';

export function useExportSession() {
  const [id, setId] = useState(() => sessionStorage.getItem('web-export-last') ?? '');
  const pending = useRef<ExportRequest | null>(null);
  const client = useQueryClient();
  const mutation = useStartExport();
  const query = useExportJob(id);
  const accept = (nextId: string) => {
    setId(nextId);
    sessionStorage.setItem('web-export-last', nextId);
  };
  const generate = async (input: Omit<ExportRequest, 'requestId'>) => {
    if (!pending.current || JSON.stringify({ ...pending.current, requestId: undefined }) !== JSON.stringify(input))
      pending.current = { ...input, requestId: crypto.randomUUID() };
    try {
      const next = await mutation.mutateAsync(pending.current);
      client.setQueryData(exportKeys.job(next.id).queryKey, next);
      accept(next.id);
      pending.current = null;
    } catch {
      const active = await client.fetchQuery(exportKeys.active).catch(() => null);
      if (active) accept(active.id);
    }
  };
  return { ...query, generate, starting: mutation.isPending, startError: mutation.error };
}
