import { createQueryKeys } from '@lukemorales/query-key-factory';
import { sessionSchema } from '@wms/contracts';
import { ApiError, request } from '../../api/client';
export const authKeys = createQueryKeys('auth', {
  session: {
    queryKey: null,
    queryFn: async () => {
      try {
        return await request('/auth/me', sessionSchema);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  },
});
