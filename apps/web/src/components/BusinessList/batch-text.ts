export const batchText = {
  history: '历史导入单据',
  pending: '尚未确认入账',
  reversed: '单据已撤销',
  voided: '单据已作废',
  unsupported: '当前状态不支持撤销',
  none: '所选单据均不可撤销，可继续导出',
  excluded: '以下单据不参与撤销',
  counts: (eligible: number, excluded: number) => `可撤销 ${eligible} 张 · 不可撤销 ${excluded} 张`,
};

export interface ExcludedBatchRow {
  id: string;
  number: string;
  reason: string;
}
