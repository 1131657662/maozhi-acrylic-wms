import { analysisQuerySchema, analysisSchema } from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const analysisOperations: Operation[] = [
  {
    method: 'get',
    path: '/web/analysis',
    channel: 'web',
    query: analysisQuerySchema,
    response: analysisSchema,
    summary: '数据看板聚合；单次只读快照、30秒按日期范围和口径缓存',
  },
];
