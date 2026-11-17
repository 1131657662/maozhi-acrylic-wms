import { z } from 'zod';
import { messageListSchema, messageQuerySchema, unreadCountSchema } from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const messageOperations: Operation[] = [
  {
    method: 'get',
    path: '/messages',
    summary: '系统通知分页及活动未读数',
    channel: 'web',
    query: messageQuerySchema,
    response: messageListSchema,
  },
  {
    method: 'get',
    path: '/messages/unread-count',
    summary: '全局活动未读数',
    channel: 'web',
    response: unreadCountSchema,
  },
  {
    method: 'post',
    path: '/messages/{id}/read',
    summary: '幂等标记已读；不存在返回404',
    channel: 'web',
    body: z.strictObject({}),
    response: unreadCountSchema,
  },
  {
    method: 'post',
    path: '/messages/read-all',
    summary: '全部活动消息幂等已读',
    channel: 'web',
    body: z.strictObject({}),
    response: unreadCountSchema,
  },
];
