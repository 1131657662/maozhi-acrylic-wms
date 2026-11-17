import { Select, theme } from 'antd';
import { messageCopy as t, messageTypeText, messageTypeSchema } from '@wms/contracts';
import type { MessageFilters } from './keys';

export function MessageFilterBar({
  filters,
  onChange,
}: {
  filters: MessageFilters;
  onChange: (value: MessageFilters) => void;
}) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginSM, marginBottom: token.margin }}>
      <Select
        aria-label={t.type}
        value={filters.type ?? ''}
        style={{ minWidth: token.controlHeight * 5 }}
        options={[
          { value: '', label: t.allTypes },
          ...messageTypeSchema.options.map((value) => ({ value, label: messageTypeText[value] })),
        ]}
        onChange={(value) => onChange({ ...filters, type: messageTypeSchema.safeParse(value).data, page: 1 })}
      />
      <Select
        aria-label={t.state}
        value={filters.unread === undefined ? '' : String(filters.unread)}
        style={{ minWidth: token.controlHeight * 5 }}
        options={[
          { value: '', label: t.allMessages },
          { value: 'true', label: t.onlyUnread },
          { value: 'false', label: t.handled },
        ]}
        onChange={(value) => onChange({ ...filters, unread: value === '' ? undefined : value === 'true', page: 1 })}
      />
    </div>
  );
}
