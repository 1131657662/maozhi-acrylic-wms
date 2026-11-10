import { useMutation } from '@tanstack/react-query';
import {
  listPreferencesSchema,
  WEB_LIST_VIEW_SCHEMA_VERSION,
  type ExportKind,
  type ListPreferenceColumns,
} from '@wms/contracts';
import { request } from '../../api/client';
export function useSavePreferences(kind: ExportKind) {
  return useMutation({
    mutationFn: (columns: ListPreferenceColumns) =>
      request(`/me/list-preferences/${kind}`, listPreferencesSchema, {
        method: 'PUT',
        body: JSON.stringify({ schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION, columns }),
      }),
    retry: false,
  });
}
