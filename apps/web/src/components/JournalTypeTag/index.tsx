import { Tag } from 'antd';

const types = new Map([
  ['inbound', '入库'],
  ['outbound', '出库'],
  ['adjustment', '库存调整'],
  ['inbound.confirm', '入库确认'],
  ['outbound.confirm', '出库确认'],
  ['stock.adjust', '库存调整'],
  ['stock.correct', '数量更正'],
  ['correction', '数量更正'],
  ['inbound.reverse', '入库误确认撤销'],
  ['outbound.reverse', '出库误确认撤销'],
  ['stocktake.post', '盘点差异回写'],
]);
export function JournalTypeTag({ type }: { type: string | null }) {
  return (
    <Tag color="default" data-testid="journal-type-tag">
      {!type ? '—' : (types.get(type) ?? '未识别')}
    </Tag>
  );
}
