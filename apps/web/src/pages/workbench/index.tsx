import { Navigate, useLocation } from '@umijs/max';
import { WorkbenchView } from '../../features/workbench/page';
import { AuthGate } from '../AuthGate';
import { internalDestination } from '../../features/outbound/list-route';

export default function WorkbenchPage() {
  const location = useLocation();
  const current = location.pathname + location.search + location.hash;
  const target = internalDestination(current);
  if (target !== current) return <Navigate to={target} replace />;
  return (
    <AuthGate>
      <WorkbenchView />
    </AuthGate>
  );
}
