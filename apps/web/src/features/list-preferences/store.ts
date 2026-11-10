import { LIST_PREFERENCES, type ExportKind, type ListPreferenceColumns, type ListPreferences } from '@wms/contracts';
import { clearCache, preferenceCache, preferenceKey, readCache, writeCache, type PreferenceCache } from './cache';

type Save = (columns: ListPreferenceColumns) => Promise<ListPreferences>;

// A single writer per identity/list survives route changes while an earlier PUT is in flight.
export class PreferenceStore {
  private snapshot: PreferenceCache;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private save?: Save;
  private ready = false;
  private writing = false;
  revision = 0;
  readonly key: string;
  constructor(
    readonly identity: string,
    readonly kind: ExportKind,
  ) {
    this.key = preferenceKey(identity, kind);
    this.snapshot = readCache(identity, kind);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (notify: () => void) => {
    this.listeners.add(notify);
    return () => {
      this.listeners.delete(notify);
    };
  };
  connect(save: Save) {
    this.save = save;
    this.ready = false;
    return () => {
      clearTimeout(this.timer);
      this.save = undefined;
    };
  }
  private publish(value: PreferenceCache) {
    this.snapshot = value;
    if (!value.dirty && value.reset) clearCache(this.identity, this.kind);
    else writeCache(this.key, value);
    this.listeners.forEach((notify) => notify());
  }
  change = (columns: ListPreferenceColumns, reset = false) => {
    if (JSON.stringify(columns) === JSON.stringify(this.snapshot.columns) && reset === this.snapshot.reset) return;
    this.revision += 1;
    this.publish(preferenceCache(columns, true, reset));
    this.schedule();
  };
  received(record: ListPreferences | undefined, readRevision: number) {
    this.ready = true;
    if (record && !this.snapshot.dirty && this.revision === readRevision) {
      if (record.updatedAt !== null)
        this.publish(preferenceCache(record.columns, false, !Object.keys(record.columns).length));
      else if (Object.keys(this.snapshot.columns).length) this.change(this.snapshot.columns);
    }
    this.schedule();
  }
  private schedule() {
    clearTimeout(this.timer);
    if (this.ready && this.save && this.snapshot.dirty)
      this.timer = setTimeout(() => void this.flush(), LIST_PREFERENCES.debounceMs);
  }
  private async flush() {
    if (this.writing || !this.save || !this.snapshot.dirty) return;
    const revision = this.revision;
    const pending = this.snapshot;
    this.writing = true;
    try {
      const record = await this.save(pending.columns);
      if (this.revision === revision) {
        this.revision += 1; // Fence GET requests that started before this successful PUT.
        this.publish(preferenceCache(record.columns, false, pending.reset && !Object.keys(record.columns).length));
      }
    } catch {
      // Keep the latest dirty cache. Retry on the next entry, not in an endless network loop.
    } finally {
      this.writing = false;
      if (this.revision !== revision) this.schedule();
    }
  }
}
const stores = new Map<string, PreferenceStore>();
export function getPreferenceStore(identity: string, kind: ExportKind): PreferenceStore {
  const key = preferenceKey(identity, kind);
  let store = stores.get(key);
  if (!store) {
    store = new PreferenceStore(identity, kind);
    stores.set(key, store);
  }
  return store;
}
