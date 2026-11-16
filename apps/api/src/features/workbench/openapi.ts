import { workbenchSchema } from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const dashboardOperations: Operation[] = [
  {
    method: 'get',
    path: '/web/dashboard',
    channel: 'web',
    response: workbenchSchema,
    summary: '工作台八区块；只读一致性快照、报表收发口径、30秒缓存及写后失效',
  },
];
