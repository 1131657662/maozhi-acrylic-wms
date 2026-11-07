import { AuthGate } from '../AuthGate';
import { InboundDetail } from '../../features/inbound/detail';

export default function InboundDetailPage() {
  return (
    <AuthGate>
      <InboundDetail />
    </AuthGate>
  );
}
