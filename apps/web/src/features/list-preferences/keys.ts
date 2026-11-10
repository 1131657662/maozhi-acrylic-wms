import { createQueryKeys } from '@lukemorales/query-key-factory';
import { listPreferencesSchema, type ExportKind } from '@wms/contracts';
import { request } from '../../api/client';
import { getPreferenceStore } from './store';

export const listPreferenceKeys = createQueryKeys('list-preferences', {
  list: (identity: string, kind: ExportKind) => ({
    queryKey: [identity, kind],
    queryFn: async () => {
      const revision = getPreferenceStore(identity, kind).revision;
      return { record: await request(`/me/list-preferences/${kind}`, listPreferencesSchema), revision };
    },
  }),
});
