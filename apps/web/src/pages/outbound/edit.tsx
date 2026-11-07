import { AuthGate } from '../AuthGate';
import { OutboundPlanEditor } from '../../features/outbound/editor';

export default function OutboundEditPage() {
  return <AuthGate><OutboundPlanEditor /></AuthGate>;
}
