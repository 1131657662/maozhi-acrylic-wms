import { z } from 'zod';
import {
  auditCursorQuerySchema,
  auditRawQuerySchema,
  auditRawSchema,
  auditPageSchema,
  auditTimelineSchema,
  auditDetailSchema,
  webAuditQuerySchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

const routes: Operation[] = [
  {
    method: 'get',
    path: '/timeline',
    summary: '最近 20 个业务对象及批量事件安全投影',
    query: webAuditQuerySchema,
    response: auditTimelineSchema,
  },
  {
    method: 'get',
    path: '/objects/{kind}/{targetId}',
    summary: '按对象类型与主键继续加载记录（含失败尝试）',
    query: auditCursorQuerySchema,
    response: auditPageSchema,
  },
  {
    method: 'get',
    path: '/{id}/events',
    summary: '对象事件游标分页',
    query: auditCursorQuerySchema,
    response: auditPageSchema,
  },
  {
    method: 'get',
    path: '/{id}/related',
    summary: '同次请求的安全摘要；不返回追踪号',
    query: auditCursorQuerySchema,
    response: auditPageSchema,
  },
  {
    method: 'get',
    path: '/{id}/raw',
    summary: '仅登录网页端读取脱敏原始数据；no-store；256 KiB/10 万条硬上限',
    query: auditRawQuerySchema,
    response: auditRawSchema,
  },
  {
    method: 'get',
    path: '/{id}/trace.json',
    summary: '完整生成脱敏诊断 JSON 后下载；重新鉴权；100 MiB/10 万条硬上限',
    response: z.unknown(),
    responseMedia: 'application/json',
  },
];
export const auditOperations: Operation[] = ['/audit', '/web/lists/audit'].flatMap((prefix) =>
  routes.map((route) => ({ ...route, path: prefix + route.path, channel: 'web', safeEnvelope: true })),
);
auditOperations.push({
  method: 'get',
  path: '/audit/{id}',
  summary: '结构化变化与关联摘要；无原始数据',
  response: auditDetailSchema,
  channel: 'web',
  safeEnvelope: true,
});
