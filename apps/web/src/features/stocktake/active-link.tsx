import { Link } from '@umijs/max';
import { theme } from 'antd';
import { workbenchCopy as copy } from '@wms/contracts';
import { useWorkbench } from '../workbench/use-workbench';
import { useSession } from '../auth/use-session';

export function ActiveStocktakeLink() {
  const { token } = theme.useToken();
  const { data: session } = useSession();
  const { data, error } = useWorkbench(true);
  const active = data?.pending.data?.stocktake;
  if (!session) return null;
  const target = active?.count.value === 1 ? active.items[0]!.href : '/stocktakes?status=counting';
  return (
    <Link
      to={target}
      data-testid="active-stocktakes"
      style={{ display: 'block', padding: token.paddingSM, fontWeight: token.fontWeightStrong, whiteSpace: 'normal' }}
    >
      {error || (data && !active) ? copy.stocktakeUnknown : `${copy.stocktake}（${active?.count.value ?? '…'}）`}
    </Link>
  );
}
