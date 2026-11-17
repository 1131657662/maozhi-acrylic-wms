import { AuthGate } from './AuthGate';
import { MaintenancePage } from '../features/maintenance/page';

export default function Maintenance() {
  return (
    <AuthGate>
      <MaintenancePage />
    </AuthGate>
  );
}
