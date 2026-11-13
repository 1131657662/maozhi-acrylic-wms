import { dateCorrectionCopy as dateText, DATE_CORRECTION_UI } from '../date-corrections/copy';
import { documentExtraCopy } from '@wms/contracts';
import type { ProColumns } from '@ant-design/pro-components';
import { billTypeText, tonnes, postingText, type WebInboundRow } from '@wms/contracts';
import { Tag } from 'antd';
import { StatusTag } from '../../components/StatusTag';
import { ListDetailLink } from '../../components/BusinessList/navigation';
import { formatTime } from '../../lib/format-time';
import { CorrectionRowActions } from '../corrections/row-actions';
import { matchedSummary } from '../../components/BusinessList/matched-lines';
import { COLUMN_WIDTH } from '../../components/BusinessList/column-settings';

export const inboundColumns: ProColumns<WebInboundRow>[] = [
  {
    title: '入库单号',
    dataIndex: 'receiptNo',
    width: 220,
    fixed: 'left',
    sorter: true,
    hideInSetting: true,
    render: (_, row) => <ListDetailLink to={'/inbound/' + row.id}>{row.receiptNo}</ListDetailLink>,
  },
  {
    title: dateText.title,
    dataIndex: 'effectiveBusinessDate',
    width: DATE_CORRECTION_UI.dateWidth,
    render: (_, row) => row.effectiveBusinessDate ?? dateText.unknown,
  },
  {
    title: documentExtraCopy.billType,
    dataIndex: 'billType',
    width: 130,
    render: (_, row) => billTypeText('inbound', row.billType),
  },
  {
    title: '商品反查',
    dataIndex: 'matchedSummary',
    key: 'matchedSummary',
    width: 300,
    hideInSetting: true,
    render: (_, row) => <span data-testid="matched-summary">{matchedSummary(row.matchedLines)}</span>,
  },
  { title: '包数', dataIndex: 'packages', sorter: true, width: 100, align: 'right' },
  {
    title: '总重量（吨）',
    dataIndex: 'weightGrams',
    sorter: true,
    width: 140,
    align: 'right',
    render: (_, row) => tonnes(row.weightGrams),
  },
  {
    title: '原始状态',
    dataIndex: 'status',
    width: COLUMN_WIDTH.status,
    minWidth: COLUMN_WIDTH.statusMin,
    fixed: 'right',
    ellipsis: false,
    onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
    onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
    render: (_, row) => <StatusTag status={row.status} kind="inbound" />,
  },
  {
    title: '入账状态',
    dataIndex: 'postingState',
    width: COLUMN_WIDTH.status,
    minWidth: COLUMN_WIDTH.statusMin,
    fixed: 'right',
    ellipsis: false,
    onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
    onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
    render: (_, row) => <Tag>{postingText[row.postingState]}</Tag>,
  },
  {
    title: '商品明细',
    dataIndex: 'products',
    width: 220,
    ellipsis: true,
    render: (_, row) => row.products.join('；') || '无有效明细',
  },
  { title: '供应商', dataIndex: 'supplierName', width: 180, ellipsis: true, sorter: true },
  { title: '仓库', dataIndex: 'warehouseName', width: 140, ellipsis: true, sorter: true },
  {
    title: '登记时间',
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
      <CorrectionRowActions
        kind="inbound"
        id={row.id}
        number={row.receiptNo}
        eligible={row.postingState === 'confirmed'}
      />
    ),
  },
];
