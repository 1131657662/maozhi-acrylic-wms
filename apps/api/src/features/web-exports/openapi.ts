import { z } from 'zod';
import { exportRequestSchema, exportJobSchema } from '@wms/contracts';
import type { Operation } from '../../openapi.ts';
export const webExportOperations: Operation[] = [
  {
    method: 'post',
    path: '/web/exports',
    summary: '固定筛选、列与视图摘要，异步生成 XLSX 或 CSV；第二任务返回 EXPORT_BUSY',
    body: exportRequestSchema,
    response: exportJobSchema,
    channel: 'web',
    successStatus: 202,
  },
  {
    method: 'get',
    path: '/web/exports/active',
    summary: '当前生成任务；没有任务返回 null',
    response: exportJobSchema.nullable(),
    channel: 'web',
  },
  {
    method: 'get',
    path: '/web/exports/{id}',
    summary: '导出进度、预览与本次范围合计；有效期24小时',
    response: exportJobSchema,
    channel: 'web',
  },
  {
    method: 'post',
    path: '/web/exports/{id}/cancel',
    summary: '取消生成；不提供部分文件',
    response: exportJobSchema,
    channel: 'web',
  },
  {
    method: 'get',
    path: '/web/exports/{id}/download',
    summary: '下载校验完成的 XLSX 或 CSV；只读 Cookie 会话下载',
    response: z.string(),
    channel: 'web',
    responseMedia: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
  },
];
