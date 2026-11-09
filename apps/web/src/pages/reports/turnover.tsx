import { AuthGate } from '../AuthGate';
import { ReportTurnover } from '../../features/reports/derived-pages';
export default function Page() {
  return (
    <AuthGate>
      <ReportTurnover />
    </AuthGate>
  );
}
