import { z } from 'zod';
import { webListOperations } from './features/web-lists/openapi.ts';
import { webExportOperations } from './features/web-exports/openapi.ts';
import { catalogOperations } from './features/catalog/openapi.ts';
import { handoffOperations } from './features/handoff/openapi.ts';
import { confirmInboundSchema, stockAdjustmentSchema, stockAdjustmentResultSchema } from '@wms/contracts';
import {
  loginSchema,
  loginResultSchema,
  sessionSchema,
  listSchema,
  listQuerySchema,
  detailSchema,
  scanRequestSchema,
  revisionSchema,
  catalogSchema,
  stockSchema,
  auditSchema,
  masterCatalogSchema,
  masterItemsSchema,
  masterItemSchema,
  createMasterItemSchema,
  updateMasterItemSchema,
  createInboundSchema,
  inboundListQuerySchema,
  inboundListSchema,
  inboundReceiptSchema,
  createOutboundPlanSchema,
  editOutboundPlanSchema,
  documentKindSchema, numberingRulesSchema, numberingRuleSchema, numberingUpdateSchema,
  journalSchema, journalQuerySchema,
  sourceStockSchema, stockSourceQuerySchema, sourceJournalSchema, sourceJournalQuerySchema,
} from '@wms/contracts';

export interface Operation {
  method: 'get' | 'post' | 'patch' | 'put';
  path: string;
  summary: string;
  response: z.ZodType;
  body?: z.ZodType;
  query?: z.ZodType;
  rawBody?: boolean;
  channel?: 'web' | 'pda' | 'any' | 'web-pda';
  idempotent?: boolean;
  responseMedia?: string;
  successStatus?: number;
}
export const operations: Operation[] = [
  ...webListOperations,
  ...webExportOperations,
  ...catalogOperations,
  ...handoffOperations,
  { method: 'post', path: '/inbound/{id}/confirm', summary: '明确确认待确认入库单；库存、流水、审计和幂等结果同事务', body: confirmInboundSchema, response: inboundReceiptSchema, channel: 'web', idempotent: true },
  { method: 'post', path: '/stock/adjustments', summary: 'ERP 库存调整；原因必填，校验当前值，原子记账', body: stockAdjustmentSchema, response: stockAdjustmentResultSchema, channel: 'web', idempotent: true },
  { method: 'get', path: '/stock/by-source', summary: '单一商品来源库存与小计；来源必填，无跨源合计；未归属不小计', query: stockSourceQuerySchema, response: sourceStockSchema, channel: 'web' },
  { method: 'get', path: '/stock/by-source/journal', summary: '单一商品来源最近流水；来源必填，不提供合计', query: sourceJournalQuerySchema, response: sourceJournalSchema, channel: 'web' },
  { method: 'get', path: '/document-numbering', summary: 'RK/CK 编号规则与非占号预览（北京时间）', response: numberingRulesSchema, channel: 'web' },
  { method: 'put', path: '/document-numbering/{kind}', summary: '修改序号宽度；拒绝撞号/溢出/过期版本，不重置计数', body: numberingUpdateSchema, response: numberingRuleSchema, channel: 'web', idempotent: true },
  { method: 'get', path: '/stock/journal', summary: '最近库存流水；保留原始类型，排除软删', query: journalQuerySchema, response: journalSchema, channel: 'web' },
  {
    method: 'get',
    path: '/health',
    summary: '本地合成环境健康检查',
    response: z.object({ status: z.literal('ok'), mode: z.literal('local-synthetic') }),
  },
  {
    method: 'post',
    path: '/auth/login',
    summary: '单用户登录；web 使用 HttpOnly Cookie，其他端返回 Bearer',
    body: loginSchema,
    response: loginResultSchema,
  },
  { method: 'get', path: '/auth/me', summary: '当前会话', response: sessionSchema, channel: 'any' },
  { method: 'post', path: '/auth/logout', summary: '撤销当前会话', response: z.null(), channel: 'any' },
  {
    method: 'get',
    path: '/outbound',
    summary: '出库列表；单号前缀筛选、服务端分页',
    query: listQuerySchema,
    response: listSchema,
    channel: 'any',
  },
  {
    method: 'post',
    path: '/outbound',
    summary: '创建待扫码出库计划；不预占库存',
    body: createOutboundPlanSchema,
    response: detailSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'patch',
    path: '/outbound/{id}',
    summary: '修改尚无扫码事实的待扫码计划',
    body: editOutboundPlanSchema,
    response: detailSchema,
    channel: 'web',
    idempotent: true,
  },
  { method: 'get', path: '/outbound/{id}', summary: '出库详情与逐包实重', response: detailSchema, channel: 'any' },
  {
    method: 'post',
    path: '/outbound/{id}/confirm',
    summary: 'Web 唯一库存扣减入口；单事务确认',
    body: revisionSchema,
    response: detailSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'get',
    path: '/inbound',
    summary: '入库记录分页查询',
    query: inboundListQuerySchema,
    response: inboundListSchema,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/inbound/{id}',
    summary: '入库单详情及商品总重量',
    response: inboundReceiptSchema,
    channel: 'web',
  },
  {
    method: 'post',
    path: '/inbound',
    summary: '创建待确认入库单；包数、总吨数独立记录，不增加库存',
    body: createInboundSchema,
    response: inboundReceiptSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'get',
    path: '/master-data/{catalog}',
    summary: '查询商品、仓库、客户或供应商目录',
    response: masterItemsSchema,
    channel: 'web',
  },
  {
    method: 'post',
    path: '/master-data/{catalog}',
    summary: '新增主数据',
    body: createMasterItemSchema,
    response: masterItemSchema,
    channel: 'web',
  },
  {
    method: 'patch',
    path: '/master-data/{catalog}/{code}',
    summary: '更新主数据名称或启停状态',
    body: updateMasterItemSchema,
    response: masterItemSchema,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/scan/plans',
    summary: 'PDA 计划列表',
    query: listQuerySchema,
    response: listSchema,
    channel: 'any',
  },
  { method: 'get', path: '/scan/plans/{id}', summary: '扫码计划及事实摘要', response: detailSchema, channel: 'any' },
  { method: 'get', path: '/scan/catalog', summary: '只读 v1 兼容目录；PDA 旧协议访问计入发布门禁', response: catalogSchema, channel: 'any' },
  {
    method: 'post',
    path: '/scan/plans/{id}/facts',
    summary: '记录不可变扫码事实；同 UUID 同正文重试幂等',
    body: scanRequestSchema,
    response: detailSchema,
    channel: 'pda',
  },
  {
    method: 'post',
    path: '/scan/plans/{id}/submit',
    summary: '冻结事实；校验 revision/digest；不扣库存',
    body: revisionSchema,
    response: detailSchema,
    channel: 'pda',
    idempotent: true,
  },
  { method: 'get', path: '/stock', summary: '只读库存（包数、整数克）', response: stockSchema, channel: 'any' },
  { method: 'get', path: '/audit', summary: '最近 100 条操作日志', response: auditSchema, channel: 'web' },
];
function parameters(operation: Operation): object[] {
  const result: object[] = [];
  if (operation.path.includes('{versionId}')) result.push({ in: 'path', name: 'versionId', required: true, schema: { type: 'integer', minimum: 1 } });
  if (operation.path.includes('{kind}'))
    result.push({ in: 'path', name: 'kind', required: true, schema: z.toJSONSchema(documentKindSchema) });
  if (operation.path.includes('{id}'))
    result.push({ in: 'path', name: 'id', required: true, schema: { type: 'string' } });
  if (operation.path.includes('{catalog}'))
    result.push({ in: 'path', name: 'catalog', required: true, schema: z.toJSONSchema(masterCatalogSchema) });
  if (operation.path.includes('{code}'))
    result.push({ in: 'path', name: 'code', required: true, schema: { type: 'string' } });
  if (operation.idempotent)
    result.push({ in: 'header', name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } });
  if (operation.query) {
    const json = z.toJSONSchema(operation.query, { io: 'input' });
    for (const [name, schema] of Object.entries(json.properties ?? {}))
      result.push({ in: 'query', name, required: false, schema });
  }
  return result;
}
function operationDocument(operation: Operation): object {
  const envelope = z.object({
    code: z.literal('OK'),
    message: z.string(),
    data: operation.response,
    traceId: z.string(),
  });
  const error = z.toJSONSchema(
    z.object({ code: z.string(), message: z.string(), data: z.null(), traceId: z.string() }),
  );
  const failures = Object.fromEntries(
    [401, 403, 404, 409, 413, 415, 422, 429, 500].map((status) => [
      status,
      { description: '统一错误信封', content: { 'application/json': { schema: error } } },
    ]),
  );
  return {
    summary: operation.summary,
    'x-client-channel': operation.channel ?? 'public',
    parameters: parameters(operation),
    security: operation.channel ? [{ cookieAuth: [] }, { bearerAuth: [] }] : [],
    ...(operation.rawBody ? {requestBody:{required:true,content:{'application/octet-stream':{schema:{type:'string',format:'binary',description:'完整 txt，最多 5 MiB；零字节代表空快照'}}}}}:{}),
    ...(operation.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: z.toJSONSchema(operation.body, { io: 'input' }) } },
          },
        }
      : {}),
    responses: {
      [operation.successStatus ?? 200]: {
        description: '成功',
        content: operation.responseMedia
          ? { [operation.responseMedia]: { schema: { type: 'string', format: 'binary' } } }
          : { 'application/json': { schema: z.toJSONSchema(envelope) } },
      },
      ...failures,
    },
  };
}
export function openApiDocument(): object {
  const paths: Record<string, Record<string, object>> = {};
  for (const operation of operations) {
    paths[operation.path] ??= {};
    paths[operation.path]![operation.method] = operationDocument(operation);
  }
  return {
    openapi: '3.1.0',
    info: { title: '茂智云仓 · 腈纶仓储管理系统 — 本地合成 API', version: '0.1.0' },
    servers: [{ url: 'http://127.0.0.1:4310/api/v1' }],
    paths,
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'wms_session' },
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
    },
  };
}
