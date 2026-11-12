import { useMutation, useQueryClient } from '@tanstack/react-query';
import { detailSchema, type ShipmentList } from '@wms/contracts';
import { useSubmissionKey } from '../../components/form-protection/use-submission-key';
import { request } from '../../api/client';
import { refreshShipment } from './refresh-shipment';

export function useShortClose(id: string) {
  const client = useQueryClient();
  const key = useSubmissionKey();
  return useMutation({
    mutationFn: ({ snapshot, reason }: { snapshot: ShipmentList; reason: string }) =>
      request(`/outbound/${id}/short-close`, detailSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': key.value() },
        body: JSON.stringify({ revision: snapshot.revision, digest: snapshot.digest, reason }),
      }),
    onSuccess: async () => {
      key.clear();
      await refreshShipment(client);
    },
  });
}
