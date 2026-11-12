import { z } from 'zod';
import {
  scanCandidatesSchema,
  scanCandidateQuerySchema,
  scanRecordInputSchema,
  scanRecordResultSchema,
  scanBatchInputSchema,
  scanBatchResultSchema,
  scanSummarySchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const scanWorkbenchOperations: Operation[] = [
  {
    method: 'get',
    path: '/outbound/{id}/scan-candidates',
    summary: '本单商品候选，片段至少四位；无可靠映射需人工确认归属',
    query: scanCandidateQuerySchema,
    response: scanCandidatesSchema,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/outbound/{id}/scan-summary',
    summary: '未撤销清点记录的计划、已录、差额及商品汇总',
    response: scanSummarySchema,
    channel: 'web',
  },
  {
    method: 'post',
    path: '/outbound/{id}/scan-records',
    summary: '按本单商品计入清点记录，不扣库存',
    body: scanRecordInputSchema,
    response: scanRecordResultSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'post',
    path: '/outbound/{id}/scan-records/batch',
    summary: '逐条独立提交，允许同批多商品与部分成功',
    body: scanBatchInputSchema,
    response: scanBatchResultSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'delete',
    path: '/outbound/{id}/scan-records/{recordId}',
    summary: '仅未确认时撤销；保留原始证据',
    response: z.object({ recordId: z.string(), revoked: z.literal(true) }),
    channel: 'web',
    idempotent: true,
  },
];
