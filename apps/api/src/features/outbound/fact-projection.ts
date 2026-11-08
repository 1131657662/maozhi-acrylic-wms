import type { Detail } from '@wms/contracts';
import { hash } from '../../shared/hash.ts';

// Exact v1 Zod output order. Context and current-catalog notices never enter this digest.
export function factDigest(facts: Detail['facts']): string {
  return hash(
    JSON.stringify(
      facts.map((f) => ({
        id: f.id,
        barcode: f.barcode,
        weightGrams: f.weightGrams,
        catalogVersion: f.catalogVersion,
        weightSource: f.weightSource,
        deviceId: f.deviceId,
        scannedAt: f.scannedAt,
        planVersion: f.planVersion,
        planId: f.planId,
        recordedBy: f.recordedBy,
        receivedAt: f.receivedAt,
      })),
    ),
  );
}
