import { AuthGate } from '../AuthGate';
import { OrderList } from '../../features/outbound/list';

export default function OutboundListPage() {
  return (
    <AuthGate>
      <OrderList />
    </AuthGate>
  );
}
