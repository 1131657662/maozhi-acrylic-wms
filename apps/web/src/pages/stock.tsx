import { AuthGate } from './AuthGate';
import { Stock } from '../features/outbound/stock';

export default function StockPage() {
  return (
    <AuthGate>
      <Stock />
    </AuthGate>
  );
}
