import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ApiError, request } from '../../api/client';

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await request('/auth/logout', z.null(), { method: 'POST' });
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    },
    onSuccess: () => {
      client.clear();
      window.location.assign('/');
    },
  });
}
