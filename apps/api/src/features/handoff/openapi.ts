import { z } from 'zod';
import {
  handoffStartSchema,
  handoffBatchSchema,
  handoffBindSchema,
  handoffOverviewSchema,
  handoffDetailSchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';
export const handoffOperations: Operation[] = [
  {
    method: 'post',
    path: '/scan/handoffs',
    channel: 'pda',
    summary: '上报不可变队列清单；X-Device-Id 必须匹配 deviceId',
    body: handoffStartSchema,
    response: z.object({ id: z.uuid() }),
  },
  {
    method: 'post',
    path: '/scan/handoffs/{id}/records',
    channel: 'pda',
    summary: '分块登记原 UUID/原正文/原 SHA；X-Device-Id 必须匹配交接设备',
    body: handoffBatchSchema,
    response: z.object({ registered: z.number() }),
  },
  {
    method: 'get',
    path: '/scan/handoffs/{id}',
    channel: 'pda',
    summary: '设备分页拉取不可变上下文；须 X-Device-Id',
    query: z.object({ page: z.number().optional() }),
    response: handoffDetailSchema,
  },
  {
    method: 'get',
    path: '/catalog/handoffs',
    channel: 'web',
    summary: '设备、未收妥记录数、未核验旧协议活动',
    response: handoffOverviewSchema,
  },
  {
    method: 'get',
    path: '/catalog/handoffs/{id}',
    channel: 'web',
    summary: '分页核对原单、条码、版本、重量与收妥情况',
    query: z.object({ page: z.number().optional() }),
    response: handoffDetailSchema,
  },
  {
    method: 'post',
    path: '/catalog/handoffs/{id}/bind',
    channel: 'web',
    summary: '按原单批量补齐 ERP 作业上下文；不改原事实',
    body: handoffBindSchema,
    response: z.object({ bound: z.number() }),
  },
  {
    method: 'post',
    path: '/catalog/handoffs/{id}/clients',
    channel: 'web',
    summary: '实物清点后审计关联旧会话/设备；不清零计数',
    body: z.object({ clientKey: z.string() }),
    response: z.object({ linked: z.boolean() }),
  },
  {
    method: 'post',
    path: '/catalog/handoffs/{id}/confirm',
    channel: 'web',
    summary: '原正文全部收妥、清单完整且旧协议水位未变才确认交接',
    response: z.object({ confirmed: z.boolean() }),
  },
];
