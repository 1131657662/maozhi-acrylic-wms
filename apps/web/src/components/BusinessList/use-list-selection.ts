import { useState, type Key } from 'react';

export function useListSelection(scope: string) {
  const [selection, setSelection] = useState<{ scope: string; keys: Key[] }>({ scope, keys: [] });
  if (selection.scope !== scope) setSelection({ scope, keys: [] });
  return {
    keys: selection.scope === scope ? selection.keys : [],
    change: (keys: Key[]) => setSelection({ scope, keys }),
  };
}
