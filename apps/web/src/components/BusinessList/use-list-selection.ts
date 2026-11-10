import { useEffect, useState, type Key } from 'react';

export function useListSelection(scope: string, rowTokens: Record<string, string> = {}) {
  const [selection, setSelection] = useState<{ scope: string; keys: Key[]; tokens: Record<string, string> }>({
    scope,
    keys: [],
    tokens: {},
  });
  useEffect(() => {
    setSelection({ scope, keys: [], tokens: {} });
  }, [scope]);
  return {
    keys: selection.scope === scope ? selection.keys : [],
    tokens: selection.scope === scope ? selection.tokens : {},
    change: (keys: Key[]) =>
      setSelection({
        scope,
        keys,
        tokens: Object.fromEntries(
          keys.map((key) => [String(key), selection.tokens[String(key)] ?? rowTokens[String(key)] ?? '']),
        ),
      }),
  };
}
