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
    summary: 'ERP 入账明细（含撤销补偿），历史上海本地时间未核实；携带收发存对账与断点诊断',
    channel: 'web',
    query: reportQuerySchema,
    response: reportDetailsSchema,
  },
  {
    method: 'get',
    path: '/web/reports/monthly',
    summary: 'ERP 仓库商品月度收发存；未知边界为 null，调整与撤销分列，不补平差额',
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
