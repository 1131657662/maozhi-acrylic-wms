import { z } from 'zod';
import { changeBusinessDateSchema, correctionInputSchema, correctionSchema } from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const correctionOperations: Operation[] = [
  {
    method: 'get',
    path: '/corrections/{id}',
    summary: '查询更正单与原单引用',
    channel: 'web',
    response: correctionSchema,
  },
  ...(['inbound', 'outbound'] as const).flatMap((kind): Operation[] => [
    {
      method: 'post',
      path: `/${kind}/{id}/corrections`,
      channel: 'web',
      idempotent: true,
      summary: '只更正包数/吨数；原单版本互斥，历史/成环/盘点/负库存拒绝；原子写流水审计幂等',
      body: correctionInputSchema,
      response: correctionSchema,
    },
    {
      method: 'get',
      path: `/${kind}/{id}/corrections`,
      summary: '查询原单更正链及抵消标记',
      channel: 'web',
      response: z.array(correctionSchema),
    },
    {
      method: 'patch',
      path: `/${kind}/{id}/business-date`,
      channel: 'web',
      idempotent: true,
      summary: '仅未锁定原单修改业务日期；未来/超期未确认/入账后修改422',
      body: changeBusinessDateSchema,
      response: z.object({ businessDate: z.string() }),
    },
  ]),
];
