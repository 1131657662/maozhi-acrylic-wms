import { AuthGate } from './AuthGate';
import { AnalysisDashboard } from '../features/analysis/dashboard';

export default function Page() {
  return (
    <AuthGate>
      <AnalysisDashboard />
    </AuthGate>
  );
}
