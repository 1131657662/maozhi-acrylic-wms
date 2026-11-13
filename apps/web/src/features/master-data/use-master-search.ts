import { useEffect, useRef, useState } from 'react';
import { MASTER_SEARCH } from './copy';

export function useMasterSearch() {
  const [state, setState] = useState({ input: '', page: 1, pending: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onSearch = (value: string) => {
    clearTimeout(timer.current);
    const input = value.trim();
    const pending = Array.from(input).length >= MASTER_SEARCH.minLength;
    setState((previous) => ({ ...previous, input, page: 1, pending }));
    if (!pending) return;
    timer.current = setTimeout(() => {
      setState({ input, page: 1, pending: false });
    }, MASTER_SEARCH.debounceMs);
  };
  const hasInput = Array.from(state.input).length >= MASTER_SEARCH.minLength;
  return {
    // Switch keys immediately to cancel the old request; enable the new one after the delay.
    query: { q: state.input, page: state.page },
    hasInput,
    pending: state.pending,
    enabled: hasInput && !state.pending,
    onSearch,
    changePage: (page: number) => setState((previous) => ({ ...previous, page })),
  };
}
