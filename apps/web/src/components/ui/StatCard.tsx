import type { CSSProperties, ReactNode } from 'react';
import { Button, theme } from 'antd';
import { color, fontSize, fontWeight, lineHeight, spacing, type DesignColors } from '../../theme/design-tokens';
import type { StatusTagType } from './StatusTag';
import { Card } from './Card';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  type?: StatusTagType;
  onClick?: () => void;
}

const colorForType: Record<StatusTagType, keyof DesignColors> = {
  default: 'text',
  processing: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export function StatCard({ label, value, type = 'default', onClick }: StatCardProps) {
  const { token } = theme.useToken();
  const colors = color(token);
  const labelStyle = { ...styles.label, color: colors.textSecondary };
  return (
    <Card padding="compact">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
        {onClick ? (
          <Button
            type="link"
            size="small"
            onClick={onClick}
            style={{ ...labelStyle, height: 'auto', paddingInline: 0 }}
          >
            {label}
          </Button>
        ) : (
          <span style={labelStyle}>{label}</span>
        )}
        <strong style={{ ...styles.value, color: colors[colorForType[type]] }}>{value}</strong>
      </div>
    </Card>
  );
}

const styles = {
  label: { fontSize: fontSize.auxiliary, lineHeight: `${lineHeight.auxiliary}px` },
  value: {
    fontSize: fontSize.kpi,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: fontWeight.semibold,
    lineHeight: `${lineHeight.kpi}px`,
    textAlign: 'right',
  },
} satisfies Record<string, CSSProperties>;
