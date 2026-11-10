import { useEffect, useState, type Key } from 'react';

export interface ListSelectionRow {
  id: Key;
  number?: string;
  eligible?: boolean;
}

export function useListSelection(scope: string, rowTokens: Record<string, string> = {}) {
  const [selection, setSelection] = useState<{
    scope: string;
    keys: Key[];
    tokens: Record<string, string>;
    rows: Record<string, ListSelectionRow>;
  }>({
    scope,
    keys: [],
    tokens: {},
    rows: {},
  });
  useEffect(() => {
    setSelection({ scope, keys: [], tokens: {}, rows: {} });
  }, [scope]);
  return {
    keys: selection.scope === scope ? selection.keys : [],
    tokens: selection.scope === scope ? selection.tokens : {},
    rows: selection.scope === scope ? selection.rows : {},
    change: (keys: Key[], rows: ListSelectionRow[] = []) =>
      setSelection((current) => {
        const selectedIds = new Set(keys.map(String));
        const previous = current.scope === scope ? current : { scope, keys: [], tokens: {}, rows: {} };
        const knownRows = { ...previous.rows, ...Object.fromEntries(rows.map((row) => [String(row.id), row])) };
        return {
          scope,
          keys,
          tokens: Object.fromEntries(
            keys.map((key) => [String(key), previous.tokens[String(key)] ?? rowTokens[String(key)] ?? '']),
          ),
          rows: Object.fromEntries(Object.entries(knownRows).filter(([id]) => selectedIds.has(id))),
        };
      }),
  };
}
