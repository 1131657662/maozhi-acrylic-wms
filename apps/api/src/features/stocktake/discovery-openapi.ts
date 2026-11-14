import {
  createDiscoverySchema,
  updateDiscoverySchema,
  deleteDiscoverySchema,
  discoverySchema,
  discoveryDeletedSchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const discoveryOperations: Operation[] = ['/stocktake/{id}/discoveries', '/stocktakes/{id}/discoveries'].flatMap(
  (path): Operation[] => [
    {
      method: 'post',
      path,
      summary: '登记快照外零账面商品，独立包克及原因必填，不写库存',
      body: createDiscoverySchema,
      response: discoverySchema,
      channel: 'web',
      idempotent: true,
    },
    {
      method: 'patch',
      path: `${path}/{lineId}`,
      summary: '版本校验后修改进行中发现行，旧回写令牌失效',
      body: updateDiscoverySchema,
      response: discoverySchema,
      channel: 'web',
      idempotent: true,
    },
    {
      method: 'delete',
      path: `${path}/{lineId}`,
      summary: '版本校验后删除进行中发现行，保留删除审计',
      body: deleteDiscoverySchema,
      response: discoveryDeletedSchema,
      channel: 'web',
      idempotent: true,
    },
  ],
);
