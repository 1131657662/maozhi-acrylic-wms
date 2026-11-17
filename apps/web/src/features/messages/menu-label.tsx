import type { ReactNode } from 'react';
import { Badge, Tooltip, theme } from 'antd';
import { MESSAGES, messageCopy as t } from '@wms/contracts';
import { useUnread } from './use-unread';

export function MessageMenuLabel({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  const { data: count, error: countError, isPending: loadingCount } = useUnread();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: token.marginXS }}>
      {children}
      {countError ? (
        <Tooltip title={t.unknown}>
          <span aria-label={t.unknown}>—</span>
        </Tooltip>
      ) : loadingCount ? (
        <span aria-label={t.unknown}>…</span>
      ) : (
        <span data-testid="message-unread-badge" aria-label={t.unreadCount(count?.unreadCount ?? 0)}>
          <Badge count={count?.unreadCount} overflowCount={MESSAGES.badgeMax} />
        </span>
      )}
    </span>
  );
}
