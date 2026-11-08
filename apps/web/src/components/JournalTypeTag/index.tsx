import { Tag } from 'antd';

const types = new Map([
  ['inbound', '入库'],
  ['outbound', '出库'],
  ['adjustment', '库存调整'],
  ['inbound.confirm', '入库确认'],
  ['outbound.confirm', '出库确认'],
  ['stock.adjust', '库存调整'],
  ['inbound.reverse', '入库误确认撤销'],
  ['outbound.reverse', '出库误确认撤销'],
]);
export function JournalTypeTag({ type }: { type: string | null }) {
  return (
    <Tag color="default" data-testid="journal-type-tag">
      {type === '' ? '空值' : (types.get(type ?? '') ?? type ?? '未记录')}
    </Tag>
  );
}
