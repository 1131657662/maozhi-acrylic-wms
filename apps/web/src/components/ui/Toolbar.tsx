import type { ReactNode } from 'react';
import { spacing } from '../../theme/design-tokens';

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div style={{ alignItems: 'center', display: 'flex', gap: spacing[8], minWidth: 0, whiteSpace: 'nowrap' }}>
      {children}
    </div>
  );
}
