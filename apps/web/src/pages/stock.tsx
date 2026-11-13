import { AuthGate } from './AuthGate';
import { StockPage as StockPageContent } from '../features/stock/page';

export default function StockPage() {
  return (
    <AuthGate>
      <StockPageContent />
    </AuthGate>
  );
}
