import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleSchema, createVehicleSchema } from '@wms/contracts';
import type { z } from 'zod';
import { request } from '../../api/client';
import { vehicleKeys } from './vehicle-keys';
import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
export function useCreateVehicle() {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  const write: (input: z.infer<typeof createVehicleSchema>) => Promise<unknown> = (input) =>
    request('/master/vehicles', vehicleSchema, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Idempotency-Key': intent.value() },
    });
  return useMutation({
    mutationFn: write,
    onSuccess: () => {
      intent.clear();
      return client.invalidateQueries({ queryKey: vehicleKeys._def });
    },
  });
}
