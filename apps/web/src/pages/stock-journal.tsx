import { AuthGate } from './AuthGate';
import { StockMovementPage } from '../features/stock/movement-page';

export default function Page() {
  return (
    <AuthGate>
      <StockMovementPage />
    </AuthGate>
  );
}
