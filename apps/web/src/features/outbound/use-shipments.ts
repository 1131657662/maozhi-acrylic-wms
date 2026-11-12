import { useQuery } from '@tanstack/react-query';
import { outboundKeys } from './keys';
import { SHIPMENT_UI } from './shipment-copy';

export function useShipments(id: string) {
  return useQuery({ ...outboundKeys.shipments(id), enabled: Boolean(id), refetchInterval: SHIPMENT_UI.pollMs });
}
