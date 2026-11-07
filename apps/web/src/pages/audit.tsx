import { AuthGate } from './AuthGate';
import { Audit } from '../features/outbound/audit';

export default function AuditPage() {
  return (
    <AuthGate>
      <Audit />
    </AuthGate>
  );
}
