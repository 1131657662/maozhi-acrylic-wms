import { createQueryKeys } from '@lukemorales/query-key-factory';
import { vehiclePageSchema, type MasterListQuery } from '@wms/contracts';
import { request } from '../../api/client';
export const vehicleKeys = createQueryKeys('vehicles', {
  list: (query: Partial<MasterListQuery>) => ({
    queryKey: [query],
    queryFn: () =>
      request(
        `/master/vehicles?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`,
        vehiclePageSchema,
      ),
  }),
});
