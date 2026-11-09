import { AuthGate } from '../AuthGate';
import { ReportAging } from '../../features/reports/derived-pages';
export default function Page() {
  return (
    <AuthGate>
      <ReportAging />
    </AuthGate>
  );
}
