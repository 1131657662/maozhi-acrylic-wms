export const reportCopy = {
  unknown: '未分类库存变动，请核对原记录',
  missingBalance: '库存变动前后的数量记录不完整',
  inconsistentChange: '库存变动前后的数量与本次增减不一致',
  negativeBalance: '库存记录出现负数',
  inconsistentDirection: '库存增减方向与操作类型不一致，保留原数量',
  brokenChain: '相邻库存记录的前后数量不衔接；未补期初或调整',
  missingTime: '库存记录缺少有效入账时间',
  stockOnly: '仅有库存余额，缺少对应的入账时间和变动记录，暂无法核对',
  stockMismatch: '末笔库存变动后的余额与当前库存不一致',
  missingImportedStock: '历史记录缺少有效的导入时库存，暂无法核对',
  importedStockMismatch: '历史末笔库存余额与导入时库存不一致',
  missingClosing: '缺少独立的期末库存记录，未按零处理',
} as const;
