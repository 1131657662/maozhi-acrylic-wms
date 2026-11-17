import { useQuery } from '@tanstack/react-query';
import { maintenanceKeys } from '../queries/maintenance-keys';

export function useArtifacts(page: number, version: string) {
  return useQuery({ ...maintenanceKeys.artifacts(page, version), retry: false });
}
