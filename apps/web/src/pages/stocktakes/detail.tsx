import { AuthGate } from '../AuthGate';
import { StocktakeDetail } from '../../features/stocktake/detail';
export default function Page() {
  return (
    <AuthGate>
      <StocktakeDetail />
    </AuthGate>
  );
}
