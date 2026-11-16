import { ANALYSIS, analysisSchema, type AnalysisQuery } from '@wms/contracts';
import { ApiError, parseResponse, request } from '../../api/client';
import type {} from './initial-request';

export async function loadAnalysis(params: AnalysisQuery) {
  const query = new URLSearchParams(params).toString(),
    path = '/web/analysis?' + query,
    initial = window.__wmsAnalysisRequest;
  delete window.__wmsAnalysisRequest;
  if (!initial || initial.query !== query || Date.now() - initial.started >= ANALYSIS.ttlMs)
    return request(path, analysisSchema);
  const result = await initial.result;
  if ('response' in result) return parseResponse(path, analysisSchema, result.response);
  throw new ApiError('', 0, '', undefined, result.error === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK', '/web/analysis');
}
