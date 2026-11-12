import type { ReactNode } from 'react';
import { Card as AntCard, theme } from 'antd';
import { color, radius, spacing } from '../../theme/design-tokens';

interface CardProps {
  children: ReactNode;
  title?: ReactNode;
  extra?: ReactNode;
  padding?: 'compact' | 'large';
  testId?: string;
}

export function Card({ children, title, extra, padding = 'compact', testId }: CardProps) {
  const { token } = theme.useToken();
  const colors = color(token);
  const bodyPadding = padding === 'large' ? spacing[24] : spacing[16];
  return (
    <AntCard
      data-testid={testId}
      extra={extra}
      title={title}
      style={{ borderColor: colors.border, borderRadius: radius.card }}
      styles={{
        body: { padding: bodyPadding },
        header: { padding: bodyPadding, minHeight: 'auto', borderColor: colors.border },
      }}
    >
      {children}
    </AntCard>
  );
}
