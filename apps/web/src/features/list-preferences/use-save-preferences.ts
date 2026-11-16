import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  listPreferencesSchema,
  WEB_LIST_VIEW_SCHEMA_VERSION,
  type ExportKind,
  type ListPreferenceColumns,
} from '@wms/contracts';
import { request } from '../../api/client';
export function useSavePreferences(kind: ExportKind) {
  const client = useQueryClient();
  // Retain Query's mutation lifecycle without subscribing the table to pending/success.
  return useCallback(
    (columns: ListPreferenceColumns) =>
      client
        .getMutationCache()
        .build(client, {
          mutationFn: (pending: ListPreferenceColumns) =>
            request(`/me/list-preferences/${kind}`, listPreferencesSchema, {
              method: 'PUT',
              body: JSON.stringify({ schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION, columns: pending }),
            }),
          retry: false,
        })
        .execute(columns),
    [client, kind],
  );
}
