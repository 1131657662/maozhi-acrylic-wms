import { createQueryKeys } from '@lukemorales/query-key-factory';
import { scanCandidatesSchema, scanSummarySchema, type ScanCandidateQuery } from '@wms/contracts';
import { request } from '../../api/client';

export function fetchCandidates(id: string, query: ScanCandidateQuery) {
  return request(
    `/outbound/${id}/scan-candidates?${new URLSearchParams({ ...query, page: String(query.page) })}`,
    scanCandidatesSchema,
  );
}
export const countingKeys = createQueryKeys('scan-counting', {
  summary: (id: string) => ({
    queryKey: [id],
    queryFn: () => request(`/outbound/${id}/scan-summary`, scanSummarySchema),
  }),
  candidates: (id: string, query: ScanCandidateQuery) => ({
    queryKey: [id, query],
    queryFn: () => fetchCandidates(id, query),
  }),
});
