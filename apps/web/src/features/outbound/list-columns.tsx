import { documentExtraCopy } from '@wms/contracts';
import type { ProColumns } from '@ant-design/pro-components';
import { billTypeText, tonnes, type WebOutboundRow } from '@wms/contracts';
import { StatusTag } from '../../components/StatusTag';
import { ListDetailLink } from '../../components/BusinessList/navigation';
import { formatTime } from '../../lib/format-time';
import { CorrectionRowActions } from '../corrections/row-actions';
import { matchedSummary } from '../../components/BusinessList/matched-lines';

export const outboundColumns: ProColumns<WebOutboundRow>[] = [
  {
    title: '出库单号',
    dataIndex: 'orderNo',
    width: 220,
    fixed: 'left',
    sorter: true,
    hideInSetting: true,
    render: (_, row) => <ListDetailLink to={'/outbound/' + row.id}>{row.orderNo}</ListDetailLink>,
  },
  {
    title: documentExtraCopy.billType,
    dataIndex: 'billType',
    width: 130,
    render: (_, row) => billTypeText('outbound', row.billType),
  },
  {
    title: '商品反查',
    dataIndex: 'matchedSummary',
    key: 'matchedSummary',
    width: 300,
    hideInSetting: true,
    render: (_, row) => <span data-testid="matched-summary">{matchedSummary(row.matchedLines)}</span>,
  },
  { title: '计划包数', dataIndex: 'plannedPackages', sorter: true, width: 100, align: 'right' },
  {
    title: '计划重量（吨）',
    dataIndex: 'plannedWeightGrams',
    sorter: true,
    width: 140,
    align: 'right',
    render: (_, row) => tonnes(row.plannedWeightGrams),
  },
  { title: '实发包数', dataIndex: 'actualPackages', sorter: true, width: 110, align: 'right' },
  {
    title: '实发重量（吨）',
    dataIndex: 'actualWeightGrams',
    sorter: true,
    width: 150,
    align: 'right',
    render: (_, row) => tonnes(row.actualWeightGrams),
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 240,
    render: (_, row) => <StatusTag status={row.status} />,
  },
  { title: '客户', dataIndex: 'customerName', width: 180, ellipsis: true, sorter: true },
  { title: '仓库', dataIndex: 'warehouseName', width: 140, ellipsis: true, sorter: true },
  { title: '车牌', dataIndex: 'vehicleNo', width: 140, ellipsis: true, sorter: true },
  {
    title: '建单时间',
    dataIndex: 'createdAt',
    width: 180,
    sorter: true,
    render: (_, row) => formatTime(row.createdAt),
  },
  {
    title: '操作',
    valueType: 'option',
    key: 'action',
    width: 180,
    fixed: 'right',
    hideInSetting: true,
    render: (_, row) => (
      <CorrectionRowActions kind="outbound" id={row.id} number={row.orderNo} eligible={row.status === 'confirmed'} />
    ),
  },
];
