import { AuthGate } from './AuthGate';
import { IdentityPage } from '../features/identity/page';

export default function Me() {
  return (
    <AuthGate>
      <IdentityPage />
    </AuthGate>
  );
}
