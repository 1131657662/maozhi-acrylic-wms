import { AuthGate } from '../AuthGate';
import { StocktakeCreate } from '../../features/stocktake/create';
export default function Page() {
  return (
    <AuthGate>
      <StocktakeCreate />
    </AuthGate>
  );
}
