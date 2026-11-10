import { useQuery } from '@tanstack/react-query';
import type { ExportKind } from '@wms/contracts';
import { listPreferenceKeys } from './keys';
export function useReadPreferences(identity: string, kind: ExportKind) {
  return useQuery({
    ...listPreferenceKeys.list(identity, kind),
    enabled: identity !== 'anonymous',
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
}
