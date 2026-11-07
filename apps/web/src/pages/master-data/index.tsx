import { AuthGate } from '../AuthGate';
import { MasterDataPage } from '../../features/master-data/page';

export default function MasterDataIndexPage() {
  return (
    <AuthGate>
      <MasterDataPage />
    </AuthGate>
  );
}
