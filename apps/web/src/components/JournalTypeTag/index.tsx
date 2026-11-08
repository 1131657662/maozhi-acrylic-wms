import { Tag } from 'antd';

const types = new Map([
  ['inbound', '入库'],
  ['outbound', '出库'],
]);
export function JournalTypeTag({ type }: { type: string | null }) {
  return (
    <Tag color="default" data-testid="journal-type-tag">
      {type === '' ? '空值' : (types.get(type ?? '') ?? type ?? '未记录')}
    </Tag>
  );
}
