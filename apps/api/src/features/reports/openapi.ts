import {
  reportQuerySchema,
  reportDetailsSchema,
  reportMonthlySchema,
  reportTurnoverQuerySchema,
  reportAgingQuerySchema,
  reportTurnoverSchema,
  reportAgingSchema,
} from '@wms/contracts';
import type { Operation } from '../../openapi.ts';
export const reportOperations: Operation[] = [
  {
    method: 'get',
    path: '/web/reports/details',
    summary: '出入库事件明细，默认入账口径；支持重述、截止时间与双水位、未归期及分类桥接，实际余额独立保留',
    channel: 'web',
    query: reportQuerySchema,
    response: reportDetailsSchema,
  },
  {
    method: 'get',
    path: '/web/reports/monthly',
    summary: '仓库商品月报，支持入账/重述及守恒桥接；实际余额不切换，无锚点的重述余额为 null',
    channel: 'web',
    query: reportQuerySchema,
    response: reportMonthlySchema,
  },
  {
    method: 'get',
    path: '/web/reports/turnover',
    summary: '吨数净出库除以完整日逐日日终平均库存，含调整盘点说明和对账诊断',
    channel: 'web',
    query: reportTurnoverQuerySchema,
    response: reportTurnoverSchema,
  },
  {
    method: 'get',
    path: '/web/reports/aging',
    summary: '截止水位吨数 FIFO 库龄五档，未知余额独立显示并提供对账诊断',
    channel: 'web',
    query: reportAgingQuerySchema,
    response: reportAgingSchema,
  },
];
