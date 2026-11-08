import { AuthGate } from '../AuthGate';
import { ReportMonthly } from '../../features/reports/pages';
export default function Page() {
  return (
    <AuthGate>
      <ReportMonthly />
    </AuthGate>
  );
}
