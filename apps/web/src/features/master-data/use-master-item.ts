import { useQuery } from '@tanstack/react-query';
import type { MasterCatalog } from '@wms/contracts';
import { masterDataKeys } from './keys';

export function useMasterItem(catalog: MasterCatalog, code: string | undefined) {
  return useQuery({ ...masterDataKeys.detail(catalog, code ?? ''), enabled: Boolean(code), retry: false });
}
