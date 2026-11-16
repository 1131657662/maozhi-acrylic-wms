import { Navigate, useLocation } from '@umijs/max';
import { AppstoreOutlined } from '@ant-design/icons';
import { workbenchCopy as copy } from '@wms/contracts';
import { PageShell } from '../../components/ui/PageShell';
import { AuthGate } from '../AuthGate';
import { internalDestination } from '../../features/outbound/list-route';

export default function WorkbenchPage() {
  const location = useLocation();
  const current = location.pathname + location.search + location.hash;
  const target = internalDestination(current);
  if (target !== current) return <Navigate to={target} replace />;
  return (
    <AuthGate>
      <PageShell title={copy.title} icon={<AppstoreOutlined />} description={copy.description}>
        {null}
      </PageShell>
    </AuthGate>
  );
}
