import {
  detailSchema,
  shipmentInputSchema,
  shipmentListSchema,
  completeShipmentSchema,
  shortCloseSchema,
  shipmentPlanSchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';

export const shipmentOperations: Operation[] = [
  {
    method: 'get',
    path: '/outbound/{id}/shipments',
    summary: '本单全部发货记录、待发与结单信息',
    response: shipmentListSchema,
    channel: 'web',
  },
  {
    method: 'post',
    path: '/outbound/{id}/shipments',
    summary: '确认本次实发；发满自动结单，否则部分发货；库存、发货记录和审计同事务',
    body: shipmentInputSchema,
    response: detailSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'post',
    path: '/outbound/{id}/complete',
    summary: '所有明细待发为零时完成发货',
    body: completeShipmentSchema,
    response: detailSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'post',
    path: '/outbound/{id}/short-close',
    summary: '记录剩余数量与原因并短关；不变库存',
    body: shortCloseSchema,
    response: detailSchema,
    channel: 'web',
    idempotent: true,
  },
  {
    method: 'patch',
    path: '/outbound/{id}/plan',
    summary: '计划中或部分发货时修改现有计划行；已发记录不变',
    body: shipmentPlanSchema,
    response: detailSchema,
    channel: 'web',
    idempotent: true,
  },
];
