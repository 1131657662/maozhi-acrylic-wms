import { useQuery } from '@tanstack/react-query';
import type { MasterCatalog, MasterListQuery } from '@wms/contracts';
import { masterDataKeys } from './keys';

export function useMasterItems(catalog: MasterCatalog, query: Partial<MasterListQuery> = {}, enabled = true) {
  return useQuery({ ...masterDataKeys.list(catalog, query), enabled });
}
