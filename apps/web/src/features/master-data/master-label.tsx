import { Space, Typography, theme } from 'antd';
import type { MasterItem } from '@wms/contracts';
import { masterCopy as t } from './copy';

export function MasterLabel({ item }: { item: Pick<MasterItem, 'code' | 'name' | 'active'> }) {
  const { token } = theme.useToken();
  return (
    <Space size="small">
      <span>
        {item.name}
        {item.active ? '' : `（${t.inactive}）`}
      </span>
      <span
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <Typography.Text
          style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}
          copyable={{ text: item.code, tooltips: [t.copyCode, t.copiedCode] }}
        >
          {item.code}
        </Typography.Text>
      </span>
    </Space>
  );
}
