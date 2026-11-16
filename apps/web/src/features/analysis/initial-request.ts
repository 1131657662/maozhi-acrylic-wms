interface InitialAnalysisRequest {
  started: number;
  query: string;
  result: Promise<{ response: Response } | { error: string }>;
}
declare global {
  interface Window {
    __wmsAnalysisRequest?: InitialAnalysisRequest;
    __wmsAnalysisSettled?: Promise<void>;
  }
}

// Serialized in HTML head. Keep independent of imports so data loads alongside the application bundle.
export function startAnalysisRequest(timeoutMs: number) {
  if (window.location.pathname !== '/dashboard') return;
  const search = new URLSearchParams(window.location.search),
    today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    fromDay = search.get('fromDay') ?? today.slice(0, 7) + '-01',
    toDay = search.get('toDay') ?? today,
    basis = search.get('basis') === 'restated' ? 'restated' : 'posted',
    query = new URLSearchParams({ fromDay, toDay, basis }).toString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/.test(toDay) || toDay > today || fromDay > toDay)
    return;
  window.__wmsAnalysisRequest = {
    started: Date.now(),
    query,
    result: fetch('/api/v1/web/analysis?' + query, {
      credentials: 'include',
      signal: AbortSignal.timeout(timeoutMs),
    }).then(
      (response) => ({ response }),
      (error: unknown) => ({ error: error instanceof Error ? error.name : 'NetworkError' }),
    ),
  };
  window.__wmsAnalysisSettled = window.__wmsAnalysisRequest.result.then(() => undefined);
}
