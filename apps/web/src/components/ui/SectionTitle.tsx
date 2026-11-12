import type { ReactNode } from 'react';
import { theme } from 'antd';
import { color, fontSize, fontWeight, lineHeight, spacing } from '../../theme/design-tokens';

interface SectionTitleProps {
  title: ReactNode;
  extra?: ReactNode;
}

export function SectionTitle({ title, extra }: SectionTitleProps) {
  const { token } = theme.useToken();
  const colors = color(token);
  return (
    <div style={{ alignItems: 'center', display: 'flex', gap: spacing[8], justifyContent: 'space-between' }}>
      <h2
        style={{
          color: colors.text,
          fontSize: fontSize.cardTitle,
          fontWeight: fontWeight.semibold,
          lineHeight: `${lineHeight.cardTitle}px`,
          margin: 0,
        }}
      >
        {title}
      </h2>
      {extra && <div style={{ alignItems: 'center', display: 'flex', gap: spacing[8] }}>{extra}</div>}
    </div>
  );
}
