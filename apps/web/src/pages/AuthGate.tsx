import type { ReactNode } from 'react';
import { Navigate, useLocation } from '@umijs/max';
import { Alert, Button, Skeleton } from 'antd';
import { useSession } from '../features/auth/use-session';

export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: session, isLoading, error, refetch } = useSession();
  if (isLoading) return <Skeleton active />;
  if (error)
    return <Alert type="error" title={error.message} action={<Button onClick={() => void refetch()}>重试</Button>} />;
  if (!session)
    return <Navigate to={`/user/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}
