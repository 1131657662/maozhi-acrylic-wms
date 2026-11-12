import type { CSSProperties, ReactNode } from 'react';
import { theme } from 'antd';
import { color, createDesignCssVariables, fontSize, fontWeight, lineHeight, spacing } from '../../theme/design-tokens';

interface PageShellProps {
  title: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, icon, description, actions, children }: PageShellProps) {
  const { token } = theme.useToken();
  const colors = color(token);
  return (
    <div style={{ ...createDesignCssVariables(token), ...styles.root } as CSSProperties}>
      <header style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            {icon && <span style={styles.icon}>{icon}</span>}
            <h1 style={{ ...styles.title, color: colors.text }}>{title}</h1>
          </div>
          {description && <div style={{ ...styles.description, color: colors.textSecondary }}>{description}</div>}
        </div>
        {actions && <div style={styles.actions}>{actions}</div>}
      </header>
      <section>{children}</section>
    </div>
  );
}

const styles = {
  root: { padding: spacing[24], minWidth: 0, maxWidth: '100%' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[16],
    marginBottom: spacing[16],
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: spacing[4] },
  icon: { display: 'inline-flex', fontSize: fontSize.cardTitle },
  title: {
    fontSize: fontSize.pageTitle,
    fontWeight: fontWeight.semibold,
    lineHeight: `${lineHeight.pageTitle}px`,
    margin: 0,
  },
  description: { fontSize: fontSize.body, lineHeight: `${lineHeight.body}px`, marginTop: spacing[4] },
  actions: { display: 'flex', alignItems: 'center', gap: spacing[8] },
} satisfies Record<string, CSSProperties>;
