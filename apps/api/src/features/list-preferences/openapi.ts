import { listPreferencesInputSchema, listPreferencesSchema } from '@wms/contracts';
import type { Operation } from '../../openapi.ts';
export const listPreferencesOperations: Operation[] = [
  {
    method: 'get',
    path: '/me/list-preferences/{kind}',
    summary: '当前登录身份的列偏好；未保存时返回空值',
    response: listPreferencesSchema,
    channel: 'web',
  },
  {
    method: 'put',
    path: '/me/list-preferences/{kind}',
    summary: '保存当前登录身份的列偏好；空 columns 重置；旧版本按列键保留',
    body: listPreferencesInputSchema,
    response: listPreferencesSchema,
    channel: 'web',
  },
];
