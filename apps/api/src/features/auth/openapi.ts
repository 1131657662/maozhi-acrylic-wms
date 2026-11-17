import { z } from 'zod';
import {
  profileSchema,
  profileInputSchema,
  passwordInputSchema,
  accountSessionsSchema,
  revokeSessionResultSchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const identityOperations: Operation[] = [
  { method: 'get', path: '/me', channel: 'web', response: profileSchema, summary: '本人资料与当前会话期限' },
  {
    method: 'put',
    path: '/me/profile',
    channel: 'web',
    body: profileInputSchema,
    response: z.null(),
    summary: '修改本人显示名',
  },
  {
    method: 'post',
    path: '/me/password',
    channel: 'web',
    body: passwordInputSchema,
    response: z.null(),
    summary: '验证原密码，同事务改密并撤销本人全部渠道会话；新密码UTF-8为12–72字节且含字母数字',
  },
  {
    method: 'get',
    path: '/me/sessions',
    channel: 'web',
    response: accountSessionsSchema,
    summary: '本人的有效登录会话',
  },
  {
    method: 'delete',
    path: '/me/sessions/{id}',
    channel: 'web',
    response: revokeSessionResultSchema,
    summary: '撤销本人指定会话；当前会话撤销等同退出',
  },
  { method: 'post', path: '/me/logout', channel: 'web', response: z.null(), summary: '退出当前网页会话' },
];
