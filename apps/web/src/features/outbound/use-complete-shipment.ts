import { useMutation, useQueryClient } from '@tanstack/react-query';
import { detailSchema, type ShipmentList } from '@wms/contracts';
import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { request } from '../../api/client';
import { refreshShipment } from './refresh-shipment';

export function useCompleteShipment(id: string) {
  const client = useQueryClient();
  const key = useSubmissionKey();
  return useMutation({
    mutationFn: ({ revision, digest }: ShipmentList) =>
      request(`/outbound/${id}/complete`, detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': key.value() },
        body: JSON.stringify({ revision, digest }),
      }),
    onSuccess: async () => {
      key.clear();
      await refreshShipment(client);
    },
  });
}
