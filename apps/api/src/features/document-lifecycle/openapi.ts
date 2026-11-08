import { lifecycleCommandSchema, lifecyclePreviewSchema } from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const lifecycleOperations: Operation[] = ['inbound', 'outbound'].flatMap((kind) => [
  {
    method: 'get',
    path: `/${kind}/{id}/lifecycle`,
    summary: '误确认撤销/未入账作废预览；列出下游阻断证据',
    channel: 'web',
    response: lifecyclePreviewSchema,
  },
  ...(['reverse', 'void'] as const).map((action) => ({
    method: 'post' as const,
    path: `/${kind}/{id}/${action}`,
    summary:
      action === 'reverse'
        ? '原流水反向补偿；保留原单与事实，不涉及实物退货'
        : '仅可证未入账且无现场下发风险单据作废；原号不复用',
    channel: 'web' as const,
    idempotent: true,
    body: lifecycleCommandSchema,
    response: lifecyclePreviewSchema,
  })),
]);
