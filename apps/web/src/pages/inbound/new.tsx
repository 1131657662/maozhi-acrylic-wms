import { AuthGate } from '../AuthGate';
import { InboundEditor } from '../../features/inbound/editor';

export default function InboundNewPage() {
  return (
    <AuthGate>
      <InboundEditor />
    </AuthGate>
  );
}
