import { AuthGate } from '../AuthGate';
import { ReportDetails } from '../../features/reports/pages';
export default function Page() {
  return (
    <AuthGate>
      <ReportDetails />
    </AuthGate>
  );
}
