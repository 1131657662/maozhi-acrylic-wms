import { reportQuerySchema, reportDetailsSchema, reportMonthlySchema } from '@wms/contracts';
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
];
