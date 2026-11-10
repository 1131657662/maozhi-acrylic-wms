import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleSchema, createVehicleSchema } from '@wms/contracts';
import type { z } from 'zod';
import { request } from '../../api/client';
import { vehicleKeys } from './vehicle-keys';
export function useCreateVehicle() {
  const client = useQueryClient();
  const write: (input: z.infer<typeof createVehicleSchema>) => Promise<unknown> = (input) =>
    request('/master/vehicles', vehicleSchema, { method: 'POST', body: JSON.stringify(input) });
  return useMutation({ mutationFn: write, onSuccess: () => client.invalidateQueries({ queryKey: vehicleKeys._def }) });
}
