import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { detailSchema, type ShipmentInput } from '@wms/contracts';
import { request } from '../../api/client';
import { refreshShipment } from './refresh-shipment';
export function useConfirm(onConfirmed: () => void) {
  const client = useQueryClient();
  const intent = useSubmissionKey();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ShipmentInput }) => {
      return request(`/outbound/${id}/shipments`, detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': intent.value() },
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      intent.clear();
      await refreshShipment(client);
      onConfirmed();
    },
  });
}
