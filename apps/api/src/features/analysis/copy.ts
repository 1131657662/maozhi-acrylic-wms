export const analysisCopy = {
  missingMovementDay: '有效收发流水缺少可核验日期；此期间不填零',
  missingPartyCode: '部分有效收发流水缺少往来方编码，相关 Top 结果不完整',
  missingDurationEvidence: '部分已完成单据缺少确认或发货时间证据',
  agingUnknown: '截止库存或库龄层证据不足，未知数不填零',
  turnoverUnknown: '至少一个月的日终库存或有效出库证据不足',
} as const;
