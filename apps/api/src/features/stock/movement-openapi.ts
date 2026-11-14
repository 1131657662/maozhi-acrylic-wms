import {
  stockMovementQuerySchema,
  stockMovementPageSchema,
  stockPeekInputSchema,
  stockPeekSchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const stockMovementOperations: Operation[] = [
  {
    method: 'post',
    path: '/stock/peek',
    channel: 'web',
    body: stockPeekInputSchema,
    response: stockPeekSchema,
    summary: '本页最多200个仓品，一条只读SQL取各自最近3条有效库存流水',
  },
  {
    method: 'get',
    path: '/stock/movements',
    channel: 'web',
    query: stockMovementQuerySchema,
    response: stockMovementPageSchema,
    summary: '库存流水只读分页；仓库/商品精确过滤，排除软删和非库存商品',
  },
];
