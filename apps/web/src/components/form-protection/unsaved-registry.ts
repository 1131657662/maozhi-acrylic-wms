export interface UnsavedEntry {
  dirty: () => boolean;
  flush: () => void;
}
const entries = new Set<UnsavedEntry>();
const listeners = new Set<() => void>();
export function notifyUnsaved() {
  listeners.forEach((listener) => listener());
}
export function subscribeUnsaved(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function hasUnsaved() {
  return unsavedEntries().length > 0;
}
export function registerUnsaved(entry: UnsavedEntry) {
  entries.add(entry);
  notifyUnsaved();
  return () => {
    entries.delete(entry);
    notifyUnsaved();
  };
}
export function unsavedEntries() {
  return [...entries].filter((entry) => entry.dirty());
}
