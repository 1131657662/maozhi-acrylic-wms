import { useRef } from 'react';

export function useSubmissionKey() {
  const intent = useRef<string | null>(crypto.randomUUID());
  return {
    value: () => (intent.current ??= crypto.randomUUID()),
    clear: () => {
      intent.current = null;
    },
  };
}
