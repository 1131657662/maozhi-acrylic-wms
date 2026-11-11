import { createQueryKeys } from '@lukemorales/query-key-factory';
import { auditRawSchema, auditPageSchema, auditTimelineSchema } from '@wms/contracts';
import { request } from '../../api/client';
const base = '/web/lists/audit';
export const auditKeys = createQueryKeys('audit-evidence', {
  raw: (id: string, params: Record<string, string>) => ({
    queryKey: [id, params],
    queryFn: () => request(`${base}/${id}/raw?${new URLSearchParams(params)}`, auditRawSchema),
  }),
  timeline: (params: Record<string, string>) => ({
    queryKey: [params],
    queryFn: () => request(`${base}/timeline?${new URLSearchParams(params)}`, auditTimelineSchema),
  }),
  object: (kind: string, id: string, cursor: string) => ({
    queryKey: [kind, id, cursor],
    queryFn: () =>
      request(
        `${base}/objects/${kind}/${encodeURIComponent(id)}?${new URLSearchParams(cursor ? { cursor } : {})}`,
        auditPageSchema,
      ),
  }),
  events: (id: string, cursor: string, related: boolean) => ({
    queryKey: [id, cursor, related],
    queryFn: () =>
      request(
        `${base}/${id}/${related ? 'related' : 'events'}?${new URLSearchParams(cursor ? { cursor } : {})}`,
        auditPageSchema,
      ),
  }),
});
