import { createQueryKeys } from '@lukemorales/query-key-factory';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountSessionsSchema, profileSchema, revokeSessionResultSchema } from '@wms/contracts';
import { z } from 'zod';
import { request } from '../../api/client';

export const identityKeys = createQueryKeys('identity', {
  profile: { queryKey: null, queryFn: () => request('/me', profileSchema) },
  sessions: { queryKey: null, queryFn: () => request('/me/sessions', accountSessionsSchema) },
});

export function useProfileSave() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) =>
      request('/me/profile', z.null(), {
        method: 'PUT',
        body: JSON.stringify({ displayName }),
      }),
    meta: { skipWorkbenchRefresh: true },
    onSuccess: () => client.invalidateQueries({ queryKey: identityKeys.profile.queryKey }),
  });
}

export function useSessionRevoke() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(`/me/sessions/${id}`, revokeSessionResultSchema, { method: 'DELETE' }),
    meta: { skipWorkbenchRefresh: true },
    onSuccess: async ({ current }) => {
      if (current) {
        client.clear();
        window.location.assign('/user/login');
      } else await client.invalidateQueries({ queryKey: identityKeys.sessions.queryKey });
    },
  });
}
