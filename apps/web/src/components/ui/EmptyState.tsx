import type { CSSProperties, ReactNode } from 'react';
import { theme } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { color, componentSize, fontSize, lineHeight, spacing } from '../../theme/design-tokens';

interface EmptyStateProps {
  description: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ description, icon, action }: EmptyStateProps) {
  const { token } = theme.useToken();
  const colors = color(token);
  return (
    <div role="status" style={{ ...containerStyle, color: colors.textSecondary }}>
      <span style={{ fontSize: fontSize.cardTitle, lineHeight: `${lineHeight.cardTitle}px` }}>
        {icon ?? <InboxOutlined />}
      </span>
      <div style={{ fontSize: fontSize.auxiliary, lineHeight: `${lineHeight.auxiliary}px` }}>{description}</div>
      {action}
    </div>
  );
}

const containerStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[8],
  justifyContent: 'center',
  maxHeight: componentSize.compactEmpty,
  overflow: 'auto',
  padding: spacing[8],
  textAlign: 'center',
};
