import { Link, useLocation } from '@umijs/max';
import type { ReactNode } from 'react';

export function ListDetailLink({ to, children }: { to: string; children: ReactNode }) {
  const location = useLocation();
  return (
    <Link to={to} state={{ listReturn: location.pathname + location.search }}>
      {children}
    </Link>
  );
}
export function ListBackLink({ fallback, children }: { fallback: string; children: ReactNode }) {
  const { state }: { state: unknown } = useLocation();
  const value = state && typeof state === 'object' && 'listReturn' in state ? state.listReturn : undefined;
  const valid = typeof value === 'string' && (value === fallback || value.startsWith(`${fallback}?`));
  return <Link to={valid ? value : fallback}>{children}</Link>;
}
