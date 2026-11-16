interface InitialRequest {
  started: number;
  result: Promise<{ response: Response } | { error: string }>;
}
declare global {
  interface Window {
    __wmsWorkbenchRequest?: InitialRequest;
  }
}

// Serialized into the HTML head; keep this function independent of runtime module imports.
export function startWorkbenchRequest(timeoutMs: number) {
  if (window.location.pathname !== '/') return;
  window.__wmsWorkbenchRequest = {
    started: Date.now(),
    result: fetch('/api/v1/web/dashboard', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    }).then(
      (response) => ({ response }),
      (error: unknown) => ({ error: error instanceof Error ? error.name : 'NetworkError' }),
    ),
  };
}
