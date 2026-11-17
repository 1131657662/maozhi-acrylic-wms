import { z } from 'zod';
import {
  backupAcceptedSchema,
  backupArtifactsSchema,
  maintenanceHealthSchema,
  maintenanceJobsQuerySchema,
  maintenanceJobsSchema,
  maintenancePageQuerySchema,
  retentionResultSchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const maintenanceOperations: Operation[] = [
  {
    method: 'post',
    path: '/maintenance/backups',
    channel: 'web',
    body: z.strictObject({}),
    idempotent: true,
    successStatus: 202,
    response: backupAcceptedSchema,
    summary: '持久化异步真实备份任务；同键重试复用，不同键并发拒绝；HTTP不可指定路径或连接',
  },
  {
    method: 'get',
    path: '/maintenance/jobs',
    channel: 'web',
    query: maintenanceJobsQuerySchema,
    response: maintenanceJobsSchema,
    summary: '维护任务状态、耗时与操作人；不暴露命令/路径/凭证',
  },
  {
    method: 'get',
    path: '/maintenance/artifacts',
    channel: 'web',
    query: maintenancePageQuerySchema,
    response: backupArtifactsSchema,
    summary: '当前可下载产物分页；大小、SHA、时间与保留类型',
  },
  {
    method: 'get',
    path: '/maintenance/artifacts/{id}/download',
    channel: 'web',
    response: z.string(),
    responseMedia: 'application/sql',
    summary: '校验文件归属、大小及SHA后下载；篡改拒绝',
  },
  {
    method: 'post',
    path: '/maintenance/retention',
    channel: 'web',
    body: z.strictObject({}),
    response: retentionResultSchema,
    summary: '保留近30日全部及近12个上海自然月各最新产物；只清已登记超期文件',
  },
  {
    method: 'get',
    path: '/maintenance/health',
    channel: 'web',
    response: maintenanceHealthSchema,
    summary: '真实数据库ping、磁盘剩余、最近备份；HTTP24h未采集明确不支持；认证断连503',
  },
];
