import { RequestError } from '../components/RequestError';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from '@umijs/max';
import { Button, Skeleton } from 'antd';
import { useSession } from '../features/auth/use-session';

export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: session, isLoading, error, refetch } = useSession();
  if (isLoading) return <Skeleton active />;
  if (error)
    return <RequestError type="error" error={error} action={<Button onClick={() => void refetch()}>重试</Button>} />;
  if (!session)
    return <Navigate to={`/user/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}
