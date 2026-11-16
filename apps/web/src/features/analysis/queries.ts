import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { AnalysisQuery } from '@wms/contracts';
import { loadAnalysis } from './load';

export const analysisKeys = createQueryKeys('analysis', {
  range: (params: AnalysisQuery) => ({
    queryKey: [params],
    queryFn: () => loadAnalysis(params),
  }),
});
