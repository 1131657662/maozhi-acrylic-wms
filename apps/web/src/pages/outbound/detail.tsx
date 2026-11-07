import { AuthGate } from '../AuthGate';
import { OrderDetail } from '../../features/outbound/detail';

export default function OutboundDetailPage() {
  return (
    <AuthGate>
      <OrderDetail />
    </AuthGate>
  );
}
