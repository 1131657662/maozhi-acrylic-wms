import type { ProColumns } from '@ant-design/pro-components';
import { tonnes, type WebOutboundRow } from '@wms/contracts';
import { StatusTag } from '../../components/StatusTag';
import { ListDetailLink } from '../../components/BusinessList/navigation';
import { formatTime } from '../../lib/format-time';

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
  { title: '计划包数', dataIndex: 'plannedPackages', width: 100, align: 'right' },
  {
    title: '计划重量（吨）',
    dataIndex: 'plannedWeightGrams',
    width: 140,
    align: 'right',
    render: (_, row) => tonnes(row.plannedWeightGrams),
  },
  { title: '实扫包数', dataIndex: 'actualPackages', width: 110, align: 'right' },
  {
    title: '实扫重量（吨）',
    dataIndex: 'actualWeightGrams',
    width: 150,
    align: 'right',
    render: (_, row) => tonnes(row.actualWeightGrams),
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 240,
    fixed: 'right',
    sorter: true,
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
    width: 100,
    fixed: 'right',
    hideInSetting: true,
    render: (_, row) => <ListDetailLink to={'/outbound/' + row.id}>查看详情</ListDetailLink>,
  },
];
