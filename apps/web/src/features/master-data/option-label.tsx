import { Typography } from 'antd';
import type { MasterItem } from '@wms/contracts';
import { MasterLabel } from './master-label';

export function MasterOptionLabel({ item }: { item: MasterItem }) {
  return (
    <div>
      <MasterLabel item={item} />
      {item.model && (
        <div>
          <Typography.Text type="secondary">{item.model}</Typography.Text>
        </div>
      )}
    </div>
  );
}
