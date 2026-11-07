import { useQuery } from '@tanstack/react-query';
import type { MasterCatalog } from '@wms/contracts';
import { masterDataKeys } from './keys';

export function useMasterItems(catalog: MasterCatalog) {
  return useQuery({ ...masterDataKeys.list(catalog) });
}
