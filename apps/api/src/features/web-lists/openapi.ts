import {
  webInboundQuerySchema,
  webOutboundQuerySchema,
  webStockQuerySchema,
  webAuditQuerySchema,
  webInboundListSchema,
  webOutboundListSchema,
  webStockListSchema,
  webAuditListSchema,
  webAuditDetailSchema,
  webStatusOptionsSchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const webListOperations: Operation[] = [
  {
    method: 'get',
    path: '/web/lists/inbound',
    summary: 'Web 入库分页；登记时间、原始状态与入账状态独立筛选',
    query: webInboundQuerySchema,
    response: webInboundListSchema,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/web/lists/outbound',
    summary: 'Web 出库分页；计划与扫码实绩分别汇总',
    query: webOutboundQuerySchema,
    response: webOutboundListSchema,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/web/lists/stock',
    summary: 'Web ERP 库存分页与同筛选范围小计；拒绝其他来源及总计参数',
    query: webStockQuerySchema,
    response: webStockListSchema,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/web/lists/audit',
    summary: '近 7 天统一安全记录分页；不读取原始 JSON',
    query: webAuditQuerySchema,
    response: webAuditListSchema,
    safeEnvelope: true,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/web/lists/audit/{id}',
    summary: '服务端结构化变化与关联摘要；原始数据需专用入口',
    response: webAuditDetailSchema,
    safeEnvelope: true,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/web/lists/{kind}/statuses',
    summary: '入库/出库原始状态选项，保留未知值和空值',
    response: webStatusOptionsSchema,
    channel: 'web',
  },
];
