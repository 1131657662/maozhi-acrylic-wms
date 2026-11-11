import { createQueryKeys } from '@lukemorales/query-key-factory';
import {
  webInboundListSchema,
  webOutboundListSchema,
  webStockListSchema,
  webAuditListSchema,
  webAuditDetailSchema,
  webStatusOptionsSchema,
} from '@wms/contracts';
import { request } from '../../api/client';

export type ListParams = Record<string, string>;
const url = (kind: string, params: ListParams) => `/web/lists/${kind}?${new URLSearchParams(params)}`;
export const webListKeys = createQueryKeys('web-lists', {
  inbound: (params: ListParams) => ({
    queryKey: [params],
    queryFn: () => request(url('inbound', params), webInboundListSchema),
  }),
  outbound: (params: ListParams) => ({
    queryKey: [params],
    queryFn: () => request(url('outbound', params), webOutboundListSchema),
  }),
  stock: (params: ListParams) => ({
    queryKey: [params],
    queryFn: () =>
      request(
        url('stock', params),
        webStockListSchema.refine((data) => data.source === (params.scope ?? params.source)),
      ),
  }),
  audit: (params: ListParams) => ({
    queryKey: [params],
    queryFn: () => request(url('audit', params), webAuditListSchema),
  }),
  auditDetail: (id: string) => ({
    queryKey: [id],
    queryFn: () => request(`/web/lists/audit/${id}`, webAuditDetailSchema),
  }),
  statuses: (kind: 'inbound' | 'outbound') => ({
    queryKey: [kind],
    queryFn: () => request(`/web/lists/${kind}/statuses`, webStatusOptionsSchema),
  }),
});
