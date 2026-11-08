import { AuthGate } from '../AuthGate';
import { NumberingPage } from '../../features/document-numbering/page';

export default function DocumentNumberingPage() {
  return (
    <AuthGate>
      <NumberingPage />
    </AuthGate>
  );
}
