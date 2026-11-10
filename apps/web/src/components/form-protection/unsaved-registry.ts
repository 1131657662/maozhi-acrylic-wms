export interface UnsavedEntry {
  dirty: () => boolean;
  flush: () => void;
}
const entries = new Set<UnsavedEntry>();
export function registerUnsaved(entry: UnsavedEntry) {
  entries.add(entry);
  return () => {
    entries.delete(entry);
  };
}
export function unsavedEntries() {
  return [...entries].filter((entry) => entry.dirty());
}
