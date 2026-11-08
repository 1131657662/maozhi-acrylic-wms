import { AuthGate } from '../AuthGate';
import { StocktakeList } from '../../features/stocktake/list';
import { useLocation } from '@umijs/max';
export default function Page() {
  const location = useLocation();
  return (
    <AuthGate>
      <StocktakeList key={location.search} />
    </AuthGate>
  );
}
