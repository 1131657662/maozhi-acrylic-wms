import { dateCorrectionInputSchema, dateCorrectionSchema, dateCorrectionHistorySchema } from '@wms/contracts';
import type { Operation } from '../../openapi.ts';
export const dateCorrectionOperations: Operation[] = (['inbound', 'outbound'] as const).flatMap((kind): Operation[] => [
  {
    method: 'post',
    path: `/${kind}/{id}/date-corrections`,
    channel: 'web',
    idempotent: true,
    summary: '追加已入账业务日期更正；独立版本互斥与幂等，不改原日期或库存',
    body: dateCorrectionInputSchema,
    response: dateCorrectionSchema,
  },
  {
    method: 'get',
    path: `/${kind}/{id}/date-corrections`,
    channel: 'web',
    summary: '查询全部日期更正记录、独立版本与当前有效业务日期',
    response: dateCorrectionHistorySchema,
  },
]);
