import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleSchema, updateVehicleSchema } from '@wms/contracts';
import type { z } from 'zod';
import { request } from '../../api/client';
import { vehicleKeys } from './vehicle-keys';
export function useUpdateVehicle() {
  const client = useQueryClient();
  const write: (input: z.infer<typeof updateVehicleSchema> & { id: string }) => Promise<unknown> = ({ id, ...input }) =>
    request(`/master/vehicles/${id}`, vehicleSchema, { method: 'PATCH', body: JSON.stringify(input) });
  return useMutation({ mutationFn: write, onSuccess: () => client.invalidateQueries({ queryKey: vehicleKeys._def }) });
}
