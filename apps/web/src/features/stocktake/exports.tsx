import { Button } from 'antd';
import { stocktakeCopy, type PublicStocktake } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { useStocktakeExport } from './use-export';

export function StocktakeExports({ take }: { take: PublicStocktake }) {
  const { mutate: download, isPending, error } = useStocktakeExport();
  return (
    <>
      {(['blank', 'result'] as const).map((kind) => (
        <Button key={kind} disabled={isPending} onClick={() => download({ id: take.id, number: take.number, kind })}>
          {kind === 'blank' ? stocktakeCopy.exportBlank : stocktakeCopy.exportResult}
        </Button>
      ))}
      {error && <RequestError type="error" error={error} />}
    </>
  );
}
