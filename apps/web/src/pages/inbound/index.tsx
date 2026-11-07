import { AuthGate } from '../AuthGate';
import { InboundList } from '../../features/inbound/list';

export default function InboundIndexPage() {
  return (
    <AuthGate>
      <InboundList />
    </AuthGate>
  );
}
