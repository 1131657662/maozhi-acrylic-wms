import { Link, useLocation } from '@umijs/max';
import type { ReactNode } from 'react';
import { internalDestination, listDestination } from '../../features/outbound/list-route';

export function ListDetailLink({ to, children }: { to: string; children: ReactNode }) {
  const location = useLocation();
  return (
    <Link to={to} state={{ listReturn: internalDestination(location.pathname + location.search + location.hash) }}>
      {children}
    </Link>
  );
}
export function ListBackLink({ fallback, children }: { fallback: string; children: ReactNode }) {
  const { state }: { state: unknown } = useLocation();
  const value = state && typeof state === 'object' && 'listReturn' in state ? state.listReturn : undefined;
  return <Link to={listDestination(value, fallback)}>{children}</Link>;
}
