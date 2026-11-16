import { useQuery } from '@tanstack/react-query';
import { ANALYSIS, type AnalysisQuery } from '@wms/contracts';
import { analysisKeys } from './queries';

export function useAnalysis(params: AnalysisQuery, enabled = true) {
  return useQuery({
    ...analysisKeys.range(params),
    enabled,
    staleTime: ANALYSIS.ttlMs,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });
}
