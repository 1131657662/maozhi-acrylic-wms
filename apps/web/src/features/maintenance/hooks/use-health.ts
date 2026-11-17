import { useQuery } from '@tanstack/react-query';
import { MAINTENANCE } from '@wms/contracts';
import { maintenanceKeys } from '../queries/maintenance-keys';

export function useHealth() {
  return useQuery({ ...maintenanceKeys.health, retry: false, refetchInterval: MAINTENANCE.pollMs });
}
