import { z } from 'zod';
import { SNAPSHOT_MISSING_TEXT } from './snapshots.ts';

export const DOCUMENT_EXTRA_LIMITS = { containerNo: 64, contractNo: 80, memo: 500 } as const;
export const documentExtraCopy = {
  billType: '单据类型',
  containerNo: '柜号',
  contractNo: '合同号',
  lineMemo: '行备注',
  allTypes: '全部类型',
  chooseType: '请选择',
  editHint: '只能修改计划信息与明细备注，客户、仓库、商品和计划数量保持不变。',
} as const;

export const inboundBillTypeSchema = z.enum(['purchase', 'return', 'other']);
export const outboundBillTypeSchema = z.enum(['sales', 'sample', 'return', 'other']);

export const inboundBillTypeOptions = [
  { value: 'purchase', label: '采购入库' },
  { value: 'return', label: '退货入库' },
  { value: 'other', label: '其他' },
] as const;
export const outboundBillTypeOptions = [
  { value: 'sales', label: '销售出库' },
  { value: 'sample', label: '样品出库' },
  { value: 'return', label: '退货出库' },
  { value: 'other', label: '其他' },
] as const;

export function billTypeText(kind: 'inbound' | 'outbound', value: string | null | undefined): string {
  if (value == null || value === '') return SNAPSHOT_MISSING_TEXT;
  const options = kind === 'inbound' ? inboundBillTypeOptions : outboundBillTypeOptions;
  return options.find((option) => option.value === value)?.label ?? '未识别';
}
