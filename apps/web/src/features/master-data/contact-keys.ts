import { createQueryKeys } from '@lukemorales/query-key-factory';
import { contactListSchema, type PartyOwner } from '@wms/contracts';
import { request } from '../../api/client';
export const contactKeys = createQueryKeys('contacts', {
  list: (owner: PartyOwner) => ({
    queryKey: [owner],
    queryFn: () => request(`/master/contacts?${new URLSearchParams(owner)}`, contactListSchema),
  }),
});
