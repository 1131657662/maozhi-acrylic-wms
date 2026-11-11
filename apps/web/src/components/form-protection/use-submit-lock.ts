import { useRef, useState } from 'react';
import { SUBMIT_LOCK_MS, formCopy } from './copy';

// Every entry point for one action shares this synchronous gate, including dialogs.
export function useSubmitLock() {
  const active = useRef<Promise<unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (active.current) return active.current.then(() => undefined);
    const start = performance.now();
    setBusy(true);
    const task = Promise.resolve()
      .then(action)
      .finally(async () => {
        const remaining = SUBMIT_LOCK_MS - (performance.now() - start);
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
        active.current = null;
        setBusy(false);
      });
    active.current = task;
    return task;
  }
  return {
    run,
    busy,
    button: { loading: busy, disabled: busy },
    text: (label: string) => (busy ? formCopy.submitting : label),
  };
}
