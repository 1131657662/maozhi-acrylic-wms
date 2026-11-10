import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ExportKind } from '@wms/contracts';
import { getPreferenceStore } from './store';
import { useReadPreferences } from './use-read-preferences';
import { useSavePreferences } from './use-save-preferences';

export function usePreferences(identity: string, kind: ExportKind) {
  const store = useMemo(() => getPreferenceStore(identity, kind), [identity, kind]);
  const { columns } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { data: preferences, isFetchedAfterMount: fetched, isError: failed } = useReadPreferences(identity, kind);
  const { mutateAsync: savePreferences } = useSavePreferences(kind);
  useEffect(
    () => (identity === 'anonymous' ? undefined : store.connect(savePreferences)),
    [store, savePreferences, identity],
  );
  useEffect(() => {
    if (fetched) store.received(failed ? undefined : preferences?.record, preferences?.revision ?? store.revision);
  }, [store, preferences, fetched, failed]);
  return { saved: columns, change: store.change, reset: () => store.change({}, true) };
}
