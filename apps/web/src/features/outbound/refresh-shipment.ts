import type { QueryClient } from '@tanstack/react-query';
import { outboundKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { webListKeys } from '../web-lists/keys';
import { lifecycleKeys } from '../document-lifecycle/keys';
import { dateCorrectionKeys } from '../date-corrections/keys';

export async function refreshShipment(client: QueryClient): Promise<void> {
  await Promise.all(
    [outboundKeys._def, stockKeys._def, webListKeys._def, lifecycleKeys._def, dateCorrectionKeys._def].map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}
