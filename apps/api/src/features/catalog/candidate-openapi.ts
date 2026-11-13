import { z } from 'zod';
import {
  catalogAbandonInputSchema,
  catalogAbandonResultSchema,
  catalogUploadResultSchema,
  catalogVersionSchema,
  catalogCandidateHandoffsSchema,
  catalogHandoffQuerySchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const candidateOperations: Operation[] = [
  {
    method: 'get',
    path: '/catalog/versions/{id}',
    summary: '目录版本最新状态和整版放弃证据；只读',
    response: catalogVersionSchema,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/catalog/versions/{id}/handoffs',
    summary: '候选基准版本的已登记交接摘要；分页只读，不代表实时设备状态',
    query: catalogHandoffQuerySchema,
    response: catalogCandidateHandoffsSchema,
    channel: 'web',
  },
  {
    method: 'post',
    path: '/catalog/versions/{id}/abandon',
    summary: '整版放弃；原因必填、追加证据与审计同事务；同键重放成功，新键重复422',
    body: catalogAbandonInputSchema,
    response: catalogAbandonResultSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'post',
    path: '/catalog/versions/{id}/rebuild',
    summary: '从上传原文显式重建新候选，使用当前基准，不恢复旧版本',
    body: z.strictObject({}),
    response: catalogUploadResultSchema,
    channel: 'web',
    idempotent: true,
  },
];
