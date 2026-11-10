import { z } from 'zod';
import {
  listPreferencesInputSchema,
  WEB_LIST_VIEW_SCHEMA_VERSION,
  type ListPreferenceColumns,
  type ExportKind,
} from '@wms/contracts';
import { columnStateSchema } from '../../components/BusinessList/column-settings';

const cacheSchema = listPreferencesInputSchema.extend({ dirty: z.boolean(), reset: z.boolean() });
export type PreferenceCache = z.infer<typeof cacheSchema>;
export const preferenceKey = (identity: string, kind: ExportKind) =>
  `b6b-list-preferences:${encodeURIComponent(identity)}:${kind}`;
const legacyPrefix = (identity: string, kind: ExportKind) =>
  `b6b-list-columns:${encodeURIComponent(identity)}:${kind}:v`;
export const preferenceCache = (
  columns: ListPreferenceColumns = {},
  dirty = false,
  reset = false,
): PreferenceCache => ({ schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION, columns, dirty, reset });

export function readCache(identity: string, kind: ExportKind): PreferenceCache {
  try {
    const raw = localStorage.getItem(preferenceKey(identity, kind));
    if (raw) return cacheSchema.parse(JSON.parse(raw));
    const prefix = legacyPrefix(identity, kind);
    const oldKey = Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix) && Number(key.slice(prefix.length)) <= WEB_LIST_VIEW_SCHEMA_VERSION)
      .sort((a, b) => Number(b.slice(prefix.length)) - Number(a.slice(prefix.length)))[0];
    return preferenceCache(oldKey ? columnStateSchema.parse(JSON.parse(localStorage.getItem(oldKey)!)) : {});
  } catch {
    return preferenceCache();
  }
}
export function writeCache(key: string, value: PreferenceCache) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* The live preference store remains usable. */
  }
}
export function clearCache(identity: string, kind: ExportKind) {
  try {
    localStorage.removeItem(preferenceKey(identity, kind));
    for (const key of Object.keys(localStorage))
      if (key.startsWith(legacyPrefix(identity, kind))) localStorage.removeItem(key);
  } catch {
    /* Storage can be disabled independently of the authenticated API. */
  }
}
