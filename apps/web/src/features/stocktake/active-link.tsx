import { useQuery } from '@tanstack/react-query';
import { Link } from '@umijs/max';
import { theme } from 'antd';
import { stocktakeKeys } from './keys';
import { useSession } from '../auth/use-session';

export function ActiveStocktakeLink() {
  const { token } = theme.useToken();
  const { data: session } = useSession();
  const { data: active, error } = useQuery({ ...stocktakeKeys.active, enabled: !!session, refetchInterval: 10000 });
  if (!session) return null;
  const target = active?.total === 1 ? `/stocktakes/${active.items[0]!.id}` : '/stocktakes?status=counting';
  return (
    <Link
      to={target}
      data-testid="active-stocktakes"
      style={{ display: 'block', padding: token.paddingSM, fontWeight: token.fontWeightStrong, whiteSpace: 'normal' }}
    >
      {error ? '盘点暂停状态待核查' : `进行中盘点（${active?.total ?? '…'}）`}
    </Link>
  );
}
